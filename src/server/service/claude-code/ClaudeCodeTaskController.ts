import { execSync } from "node:child_process";
import { query } from "@anthropic-ai/claude-code";
import { ulid } from "ulid";
import {
  createMessageGenerator,
  type MessageGenerator,
  type OnMessage,
} from "./createMessageGenerator";

type BaseClaudeCodeTask = {
  id: string;
  projectId: string;
  baseSessionId?: string | undefined; // undefined = new session
  cwd: string;
  generateMessages: MessageGenerator;
  setNextMessage: (message: string) => void;
  onMessageHandlers: OnMessage[];
};

type PendingClaudeCodeTask = BaseClaudeCodeTask & {
  status: "pending";
};

type RunningClaudeCodeTask = BaseClaudeCodeTask & {
  status: "running";
  sessionId: string;
  userMessageId: string;
  abortController: AbortController;
};

type PausedClaudeCodeTask = BaseClaudeCodeTask & {
  status: "paused";
  sessionId: string;
  userMessageId: string;
  abortController: AbortController;
};

type CompletedClaudeCodeTask = BaseClaudeCodeTask & {
  status: "completed";
  sessionId: string;
  userMessageId: string;
  abortController: AbortController;
};

type FailedClaudeCodeTask = BaseClaudeCodeTask & {
  status: "failed";
  sessionId?: string;
  userMessageId?: string;
  abortController?: AbortController;
};

type ClaudeCodeTask =
  | RunningClaudeCodeTask
  | PausedClaudeCodeTask
  | CompletedClaudeCodeTask
  | FailedClaudeCodeTask;

type AliveClaudeCodeTask = RunningClaudeCodeTask | PausedClaudeCodeTask;

export class ClaudeCodeTaskController {
  private pathToClaudeCodeExecutable: string;
  private tasks: ClaudeCodeTask[] = [];

  constructor() {
    this.pathToClaudeCodeExecutable = execSync("which claude", {})
      .toString()
      .trim();
  }

  public get aliveTasks() {
    return this.tasks.filter(
      (task) => task.status === "running" || task.status === "paused",
    );
  }

  public async startOrContinueTask(
    currentSession: {
      cwd: string;
      projectId: string;
      sessionId?: string;
    },
    message: string,
  ): Promise<AliveClaudeCodeTask> {
    const existingTask = this.aliveTasks.find(
      (task) => task.sessionId === currentSession.sessionId,
    );

    if (existingTask) {
      return this.continueTask(existingTask, message);
    } else {
      return await this.startTask(currentSession, message);
    }
  }

  private continueTask(task: AliveClaudeCodeTask, message: string) {
    task.setNextMessage(message);
    return task;
  }

  private startTask(
    currentSession: {
      cwd: string;
      projectId: string;
      sessionId?: string;
    },
    message: string,
  ) {
    const { generateMessages, setNextMessage } =
      createMessageGenerator(message);

    const task: PendingClaudeCodeTask = {
      status: "pending",
      id: ulid(),
      projectId: currentSession.projectId,
      baseSessionId: currentSession.sessionId,
      cwd: currentSession.cwd,
      generateMessages,
      setNextMessage,
      onMessageHandlers: [],
    };

    let aliveTaskResolve: (task: AliveClaudeCodeTask) => void;
    let aliveTaskReject: (error: unknown) => void;

    const aliveTaskPromise = new Promise<AliveClaudeCodeTask>(
      (resolve, reject) => {
        aliveTaskResolve = resolve;
        aliveTaskReject = reject;
      },
    );

    let resolved = false;

    const handleTask = async () => {
      try {
        const abortController = new AbortController();

        let currentTask: AliveClaudeCodeTask | undefined;

        for await (const message of query({
          prompt: task.generateMessages(),
          options: {
            resume: task.baseSessionId,
            cwd: task.cwd,
            pathToClaudeCodeExecutable: this.pathToClaudeCodeExecutable,
            permissionMode: "bypassPermissions",
            abortController: abortController,
          },
        })) {
          currentTask ??= this.aliveTasks.find((t) => t.id === task.id);

          if (currentTask !== undefined && currentTask.status === "paused") {
            this.updateExistingTask({
              ...currentTask,
              status: "running",
            });
          }

          // 初回の system message だとまだ history ファイルが作成されていないので
          if (
            !resolved &&
            (message.type === "user" || message.type === "assistant") &&
            message.uuid !== undefined
          ) {
            const runningTask: RunningClaudeCodeTask = {
              status: "running",
              id: task.id,
              projectId: task.projectId,
              cwd: task.cwd,
              generateMessages: task.generateMessages,
              setNextMessage: task.setNextMessage,
              onMessageHandlers: task.onMessageHandlers,
              userMessageId: message.uuid,
              sessionId: message.session_id,
              abortController: abortController,
            };
            this.tasks.push(runningTask);
            aliveTaskResolve(runningTask);
            resolved = true;
          }

          await Promise.all(
            task.onMessageHandlers.map(async (onMessageHandler) => {
              await onMessageHandler(message);
            }),
          );

          if (currentTask !== undefined && message.type === "result") {
            this.updateExistingTask({
              ...currentTask,
              status: "paused",
            });
          }
        }

        const updatedTask = this.aliveTasks.find((t) => t.id === task.id);

        if (updatedTask === undefined) {
          const error = new Error(
            `illegal state: task is not running, task: ${JSON.stringify(updatedTask)}`,
          );
          aliveTaskReject(error);
          throw error;
        }

        this.updateExistingTask({
          ...updatedTask,
          status: "completed",
        });
      } catch (error) {
        if (!resolved) {
          aliveTaskReject(error);
          resolved = true;
        }

        console.error("Error resuming task", error);
        this.updateExistingTask({
          ...task,
          status: "failed",
        });
      }
    };

    // continue background
    void handleTask();

    return aliveTaskPromise;
  }

  public abortTask(sessionId: string) {
    const task = this.aliveTasks.find((task) => task.sessionId === sessionId);
    if (!task) {
      throw new Error("Alive Task not found");
    }

    task.abortController.abort();
    this.updateExistingTask({
      id: task.id,
      projectId: task.projectId,
      sessionId: task.sessionId,
      status: "failed",
      cwd: task.cwd,
      generateMessages: task.generateMessages,
      setNextMessage: task.setNextMessage,
      onMessageHandlers: task.onMessageHandlers,
      baseSessionId: task.baseSessionId,
      userMessageId: task.userMessageId,
    });
  }

  private updateExistingTask(task: ClaudeCodeTask) {
    const target = this.tasks.find((t) => t.id === task.id);

    if (!target) {
      throw new Error("Task not found");
    }

    Object.assign(target, task);
  }
}
