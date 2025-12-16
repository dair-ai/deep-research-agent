"use client";

import { useState, useCallback, useRef } from "react";
import type { ResearchSource, ResearchStep } from "@/types/research";

// Claude Agent SDK message format
interface ContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface AgentMessage {
  type: "user" | "assistant" | "system";
  message?: {
    role: string;
    content: ContentBlock[] | string;
  };
  session_id?: string;
  uuid?: string;
  tool_use_result?: string;
  parent_tool_use_id?: string | null;
  subtype?: string;
}

interface ResearchState {
  status: "idle" | "researching" | "completed" | "error";
  steps: ResearchStep[];
  sources: ResearchSource[];
  report: string;
  sessionId?: string;
  error?: string;
}

export function useResearchAgent() {
  const [state, setState] = useState<ResearchState>({
    status: "idle",
    steps: [],
    sources: [],
    report: ""
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const startResearch = useCallback(async (topic: string) => {
    // Cancel any ongoing research
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setState({
      status: "researching",
      steps: [{
        id: "init",
        type: "search",
        status: "in_progress",
        description: "Starting deep research...",
        timestamp: Date.now()
      }],
      sources: [],
      report: ""
    });

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, sessionId: state.sessionId }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Research failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let currentReport = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          if (!data) continue;

          try {
            const message = JSON.parse(data) as AgentMessage;
            console.log("Agent message:", message);

            // Capture session ID
            if (message.session_id && !state.sessionId) {
              setState(prev => ({ ...prev, sessionId: message.session_id }));
            }

            // Get content blocks from the message
            const contentBlocks: ContentBlock[] = [];
            if (message.message?.content) {
              if (Array.isArray(message.message.content)) {
                contentBlocks.push(...message.message.content);
              } else if (typeof message.message.content === "string") {
                contentBlocks.push({ type: "text", text: message.message.content });
              }
            }

            // Process each content block
            for (const block of contentBlocks) {
              // Handle tool use - track searches
              if (block.type === "tool_use" && block.name) {
                let stepDescription = "";
                const toolInput = block.input || {};

                if (block.name.includes("search")) {
                  stepDescription = `Searching: "${toolInput.query || "..."}"`;
                } else if (block.name.includes("get_contents")) {
                  stepDescription = `Reading content from sources...`;
                } else if (block.name.includes("find_similar")) {
                  stepDescription = `Finding similar sources...`;
                } else {
                  stepDescription = `Using tool: ${block.name}`;
                }

                setState(prev => ({
                  ...prev,
                  steps: [...prev.steps.map(s => ({ ...s, status: "completed" as const })), {
                    id: `step-${Date.now()}-${block.id}`,
                    type: "search" as const,
                    status: "in_progress" as const,
                    description: stepDescription,
                    timestamp: Date.now()
                  }]
                }));
              }

              // Handle text content - build report
              if (block.type === "text" && block.text) {
                currentReport += block.text;
                setState(prev => ({
                  ...prev,
                  report: currentReport
                }));
              }
            }

            // Handle tool results from user messages (tool_use_result field)
            if (message.type === "user" && message.tool_use_result) {
              // Check for errors
              if (message.tool_use_result.startsWith("Error:")) {
                console.warn("Tool error:", message.tool_use_result);
                continue;
              }

              try {
                const result = JSON.parse(message.tool_use_result);
                if (result.results && Array.isArray(result.results)) {
                  const newSources = result.results.map((r: Record<string, unknown>) => ({
                    title: (r.title as string) || "Untitled",
                    url: r.url as string,
                    author: r.author as string | undefined,
                    publishedDate: (r.published_date || r.publishedDate) as string | undefined,
                    snippet: ((r.text as string) || "").substring(0, 200)
                  }));
                  setState(prev => ({
                    ...prev,
                    sources: [...new Map([...prev.sources, ...newSources].map(s => [s.url, s])).values()]
                  }));
                }
              } catch {
                // Not JSON or different format
              }
            }

          } catch (e) {
            console.warn("Failed to parse message:", data, e);
          }
        }
      }

      setState(prev => ({
        ...prev,
        status: "completed",
        steps: [...prev.steps.map(s => ({ ...s, status: "completed" as const })), {
          id: "complete",
          type: "complete" as const,
          status: "completed" as const,
          description: "Research complete",
          timestamp: Date.now()
        }]
      }));

    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setState(prev => ({ ...prev, status: "idle" }));
        return;
      }
      console.error("Research error:", error);
      setState(prev => ({
        ...prev,
        status: "error",
        error: error instanceof Error ? error.message : "An error occurred"
      }));
    }
  }, [state.sessionId]);

  const cancelResearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState(prev => ({ ...prev, status: "idle" }));
    }
  }, []);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      status: "idle",
      steps: [],
      sources: [],
      report: ""
    });
  }, []);

  return {
    ...state,
    startResearch,
    cancelResearch,
    reset
  };
}
