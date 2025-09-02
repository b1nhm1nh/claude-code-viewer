import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  LoaderIcon,
  MessageSquareIcon,
  SendIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type FC, useId, useRef, useState } from "react";

import { Button } from "../../../../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../../../../components/ui/card";
import { Textarea } from "../../../../../../../components/ui/textarea";
import { honoClient } from "../../../../../../../lib/api/client";
import {
  CommandCompletion,
  type CommandCompletionRef,
} from "../../../../components/newChat/CommandCompletion";

export const ResumeChat: FC<{
  projectId: string;
  sessionId: string;
  isPausedTask: boolean;
}> = ({ projectId, sessionId, isPausedTask }) => {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  const resumeChat = useMutation({
    mutationFn: async (options: { message: string }) => {
      const response = await honoClient.api.projects[":projectId"].sessions[
        ":sessionId"
      ].resume.$post({
        param: { projectId, sessionId },
        json: { resumeMessage: options.message },
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      await queryClient.invalidateQueries({ queryKey: ["aliveTasks"] });

      return response.json();
    },
    onSuccess: async (response) => {
      setMessage("");
      await queryClient.invalidateQueries({ queryKey: ["aliveTasks"] });
      if (sessionId !== response.sessionId) {
        router.push(
          `/projects/${projectId}/sessions/${response.sessionId}#message-${response.userMessageId}`,
        );
      }
    },
  });

  const [message, setMessage] = useState("");
  const completionRef = useRef<CommandCompletionRef>(null);
  const helpId = useId();

  const handleSubmit = () => {
    if (!message.trim()) return;
    resumeChat.mutate({ message: message.trim() });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // まずコマンド補完のキーボードイベントを処理
    if (completionRef.current?.handleKeyDown(e)) {
      return;
    }

    // 通常のキーボードイベント処理
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCommandSelect = (command: string) => {
    setMessage(command);
    textareaRef.current?.focus();
  };

  return (
    <Card className="border-t rounded-t-none border-x-0 bg-background/50 backdrop-blur-sm mt-10">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <MessageSquareIcon className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Continue Conversation</CardTitle>
        </div>
        <CardDescription>
          Start a new conversation based on this session's context
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {resumeChat.error && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
            <AlertCircleIcon className="w-4 h-4" />
            <span>Failed to resume chat. Please try again.</span>
          </div>
        )}

        <div className="space-y-3">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message here... (Start with / for commands, Shift+Enter to send)"
              className="min-h-[80px] resize-none"
              disabled={resumeChat.isPending}
              maxLength={4000}
              aria-label="Message input with command completion"
              aria-describedby={helpId}
              aria-expanded={message.startsWith("/")}
              aria-haspopup="listbox"
              role="combobox"
              aria-autocomplete="list"
            />
            <CommandCompletion
              ref={completionRef}
              projectId={projectId}
              inputValue={message}
              onCommandSelect={handleCommandSelect}
              className="absolute top-full left-0 right-0"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground" id={helpId}>
              {message.length}/4000 characters • Use arrow keys to navigate
              commands
            </span>

            <Button
              onClick={handleSubmit}
              disabled={!message.trim() || resumeChat.isPending}
              size="lg"
              className="gap-2"
            >
              {resumeChat.isPending ? (
                <>
                  <LoaderIcon className="w-4 h-4 animate-spin" />
                  Starting... This may take a while.
                </>
              ) : isPausedTask ? (
                <>
                  <SendIcon className="w-4 h-4" />
                  Send
                </>
              ) : (
                <>
                  <SendIcon className="w-4 h-4" />
                  Resume
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
