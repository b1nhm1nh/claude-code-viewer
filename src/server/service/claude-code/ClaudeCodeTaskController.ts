import { execSync } from "node:child_process";
import { query, type SDKMessage } from "@anthropic-ai/claude-code";
import { ulid } from "ulid";

type OnMessage = (message: SDKMessage) => void | Promise<void>;

type BaseClaudeCodeTask = {
  id: string;
  projectId: string;
  sessionId?: string | undefined; // undefined = new session
  cwd: string;
  message: string;
  onMessageHandlers: OnMessage[];
};

type PendingClaudeCodeTask = BaseClaudeCodeTask & {
  status: "pending";
};

type RunningClaudeCodeTask = BaseClaudeCodeTask & {
  status: "running";
  nextSessionId: string;
  userMessageId: string;
  abortController: AbortController;
};

type CompletedClaudeCodeTask = BaseClaudeCodeTask & {
  status: "completed";
  nextSessionId: string;
  userMessageId: string;
};

type FailedClaudeCodeTask = BaseClaudeCodeTask & {
  status: "failed";
  nextSessionId?: string;
  userMessageId?: string;
};

type ClaudeCodeTask =
  | PendingClaudeCodeTask
  | RunningClaudeCodeTask
  | CompletedClaudeCodeTask
  | FailedClaudeCodeTask;

export class ClaudeCodeTaskController {
  private pathToClaudeCodeExecutable: string;
  private tasks: ClaudeCodeTask[] = [];

  constructor() {
    this.pathToClaudeCodeExecutable = execSync("which claude", {})
      .toString()
      .trim();
  }

  public async createTask(
    taskDef: Omit<ClaudeCodeTask, "id" | "status" | "onMessageHandlers">,
    onMessage?: OnMessage,
  ) {
    const task: ClaudeCodeTask = {
      ...taskDef,
      id: ulid(),
      status: "pending",
      onMessageHandlers: typeof onMessage === "function" ? [onMessage] : [],
    };

    this.tasks.push(task);

    return task;
  }

  public get pendingTasks() {
    return this.tasks.filter((task) => task.status === "pending");
  }

  public get runningTasks() {
    return this.tasks.filter((task) => task.status === "running");
  }

  private updateExistingTask(task: ClaudeCodeTask) {
    const target = this.tasks.find((t) => t.id === task.id);

    if (!target) {
      throw new Error("Task not found");
    }

    Object.assign(target, task);
  }

  public startTask(id: string) {
    const task = this.tasks.find((task) => task.id === id);
    if (!task) {
      throw new Error("Task not found");
    }

    let runningTaskResolve: (task: RunningClaudeCodeTask) => void;
    let runningTaskReject: (error: unknown) => void;
    const runningTaskPromise = new Promise<RunningClaudeCodeTask>(
      (resolve, reject) => {
        runningTaskResolve = resolve;
        runningTaskReject = reject;
      },
    );

    let resolved = false;

    const handleTask = async () => {
      try {
        const abortController = new AbortController();

        for await (const message of query({
          prompt: task.message,
          options: {
            resume: task.sessionId,
            cwd: task.cwd,
            pathToClaudeCodeExecutable: this.pathToClaudeCodeExecutable,
            permissionMode: "bypassPermissions",
            abortController,
          },
        })) {
          // 初回の sysmte message だとまだ history ファイルが作成されていないので
          if (
            !resolved &&
            (message.type === "user" || message.type === "assistant") &&
            message.uuid !== undefined
          ) {
            const runningTask: RunningClaudeCodeTask = {
              ...task,
              status: "running",
              nextSessionId: message.session_id,
              userMessageId: message.uuid,
              abortController,
            };
            this.updateExistingTask(runningTask);
            runningTaskResolve(runningTask);
            resolved = true;
          }

          await Promise.all(
            task.onMessageHandlers.map(async (onMessageHandler) => {
              await onMessageHandler(message);
            }),
          );
        }

        if (task.status !== "running") {
          const error = new Error(
            `illegal state: task is not running, task: ${JSON.stringify(task)}`,
          );
          runningTaskReject(error);
          throw error;
        }

        this.updateExistingTask({
          ...task,
          status: "completed",
          nextSessionId: task.nextSessionId,
          userMessageId: task.userMessageId,
        });
      } catch (error) {
        if (!resolved) {
          runningTaskReject(error);
          resolved = true;
        }

        console.error("Error resuming task", error);
        task.status = "failed";
      }
    };

    // continue background
    void handleTask();

    return runningTaskPromise;
  }

  public abortTask(sessionId: string) {
    const task = this.tasks
      .filter((task) => task.status === "running")
      .find((task) => task.nextSessionId === sessionId);
    if (!task) {
      throw new Error("Running Task not found");
    }

    task.abortController.abort();
    this.updateExistingTask({
      id: task.id,
      status: "failed",
      cwd: task.cwd,
      message: task.message,
      onMessageHandlers: task.onMessageHandlers,
      projectId: task.projectId,
      nextSessionId: task.nextSessionId,
      sessionId: task.sessionId,
      userMessageId: task.userMessageId,
    });
  }
}
