import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { projetsQueryConfig } from "../app/projects/hooks/useProjects";
import { honoClient } from "../lib/api/client";
import type { SSEEvent } from "../server/service/events/types";

type ParsedEvent = {
  event: string;
  data: SSEEvent;
  id: string;
};

const parseSSEEvent = (text: string): ParsedEvent => {
  const lines = text.split("\n");
  const eventIndex = lines.findIndex((line) => line.startsWith("event:"));
  const dataIndex = lines.findIndex((line) => line.startsWith("data:"));
  const idIndex = lines.findIndex((line) => line.startsWith("id:"));

  const endIndex = (index: number) => {
    const targets = [eventIndex, dataIndex, idIndex, lines.length].filter(
      (current) => current > index,
    );
    return Math.min(...targets);
  };

  if (eventIndex === -1 || dataIndex === -1 || idIndex === -1) {
    console.error("failed", text);
    throw new Error("Failed to parse SSE event");
  }

  const event = lines.slice(eventIndex, endIndex(eventIndex)).join("\n");
  const data = lines.slice(dataIndex, endIndex(dataIndex)).join("\n");
  const id = lines.slice(idIndex, endIndex(idIndex)).join("\n");

  return {
    id: id.slice("id:".length).trim(),
    event: event.slice("event:".length).trim(),
    data: JSON.parse(
      data.slice(data.indexOf("{"), data.indexOf("}") + 1),
    ) as SSEEvent,
  };
};

const parseSSEEvents = (text: string): ParsedEvent[] => {
  const eventTexts = text
    .split("\n\n")
    .filter((eventText) => eventText.length > 0);

  return eventTexts.map((eventText) => parseSSEEvent(eventText));
};

let isInitialized = false;

export const useServerEvents = () => {
  const queryClient = useQueryClient();

  const listener = useCallback(async () => {
    console.log("listening to events");
    const response = await honoClient.api.events.state_changes.$get();

    if (!response.ok) {
      throw new Error("Failed to fetch events");
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Failed to get reader");
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const events = parseSSEEvents(decoder.decode(value));

      for (const event of events) {
        console.log("data", event);

        if (event.data.type === "project_changed") {
          await queryClient.invalidateQueries({
            queryKey: projetsQueryConfig.queryKey,
          });
        }

        if (event.data.type === "session_changed") {
          await queryClient.invalidateQueries({ queryKey: ["sessions"] });
        }
      }
    }
  }, [queryClient]);

  useEffect(() => {
    if (isInitialized === false) {
      void listener()
        .then(() => {
          console.log("registered events listener");
          isInitialized = true;
        })
        .catch((error) => {
          console.error("failed to register events listener", error);
          isInitialized = true;
        });
    }
  }, [listener]);
};
