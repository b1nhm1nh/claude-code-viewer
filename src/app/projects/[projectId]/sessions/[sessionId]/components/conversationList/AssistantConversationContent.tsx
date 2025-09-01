import { ChevronDown, FileText, Lightbulb, Settings } from "lucide-react";
import type { FC } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ToolResultContent } from "@/lib/conversation-schema/content/ToolResultContentSchema";
import type { AssistantMessageContent } from "@/lib/conversation-schema/message/AssistantMessageSchema";
import { MarkdownContent } from "../../../../../../components/MarkdownContent";

export const AssistantConversationContent: FC<{
  content: AssistantMessageContent;
  getToolResult: (toolUseId: string) => ToolResultContent | undefined;
}> = ({ content, getToolResult }) => {
  if (content.type === "text") {
    return (
      <div className="w-full mx-2 my-6">
        <MarkdownContent content={content.text} />
      </div>
    );
  }

  if (content.type === "thinking") {
    return (
      <Card className="bg-muted/50 border-dashed gap-2 py-3 mb-2">
        <Collapsible>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/80 rounded-t-lg transition-colors py-0 px-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Thinking</CardTitle>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="py-0 px-4">
              <div className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                {content.thinking}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  if (content.type === "tool_use") {
    const toolResult = getToolResult(content.id);

    return (
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20 gap-2 py-3 mb-2">
        <CardHeader className="py-0 px-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <CardTitle className="text-sm font-medium">Tool Use</CardTitle>
            <Badge
              variant="outline"
              className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300"
            >
              {content.name}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Tool execution with ID: {content.id}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 py-0 px-4">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded p-2 -mx-2">
                <h4 className="text-xs font-medium text-muted-foreground">
                  Input Parameters
                </h4>
                <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-background rounded border p-2 mt-1">
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(content.input, null, 2)}
                </pre>
              </div>
            </CollapsibleContent>
          </Collapsible>
          {toolResult && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded p-2 -mx-2">
                  <h4 className="text-xs font-medium text-muted-foreground">
                    Tool Result
                  </h4>
                  <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-background rounded border p-2 mt-1">
                  {typeof toolResult.content === "string" ? (
                    <pre className="text-xs overflow-x-auto whitespace-pre-line">
                      {toolResult.content}
                    </pre>
                  ) : (
                    toolResult.content.map((item) => {
                      if (item.type === "image") {
                        return (
                          <img
                            key={item.source.data}
                            src={`data:${item.source.media_type};base64,${item.source.data}`}
                            alt="Tool Result"
                          />
                        );
                      }
                      if (item.type === "text") {
                        return (
                          <pre
                            key={item.text}
                            className="text-xs overflow-x-auto whitespace-pre-line"
                          >
                            {item.text}
                          </pre>
                        );
                      }
                      item satisfies never;
                      throw new Error("Unexpected tool result content type");
                    })
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>
    );
  }

  if (content.type === "tool_result") {
    return (
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 gap-2 py-3">
        <CardHeader className="py-0 px-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <CardTitle className="text-sm font-medium">Tool Result</CardTitle>
            <Badge
              variant="outline"
              className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300"
            >
              Debug
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="py-0 px-4">
          <div className="bg-background rounded border p-2">
            <pre className="text-xs overflow-x-auto">
              {JSON.stringify(content, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};
