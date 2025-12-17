"use client";

import { useState, useCallback, useRef } from "react";
import type {
  ResearchSource,
  ResearchStep,
  PipelineStage,
  StageProgress,
  StageChangeMessage
} from "@/types/research";
import { createInitialStages } from "@/types/research";

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
  type: "user" | "assistant" | "system" | "stage_change" | "result" | "status" | "error";
  message?: {
    role: string;
    content: ContentBlock[] | string;
  };
  session_id?: string;
  uuid?: string;
  tool_use_result?: string;
  parent_tool_use_id?: string | null;
  subtype?: string;
  // Stage change fields
  stage?: PipelineStage;
  timestamp?: number;
  description?: string;
  // Result message fields
  result?: string;
  duration_ms?: number;
  num_turns?: number;
  total_cost_usd?: number;
  // Status/error fields
  content?: string;
}

interface ResearchState {
  status: "idle" | "researching" | "completed" | "error";
  currentStage: PipelineStage | null;
  stages: StageProgress[];
  steps: ResearchStep[];
  sources: ResearchSource[];
  report: string;
  sessionId?: string;
  error?: string;
}

export function useResearchAgent() {
  const [state, setState] = useState<ResearchState>({
    status: "idle",
    currentStage: null,
    stages: createInitialStages(),
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
      currentStage: null,
      stages: createInitialStages(),
      steps: [{
        id: "init",
        type: "search",
        status: "in_progress",
        description: "Starting multi-agent research pipeline...",
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

            // Handle stage change events
            if (message.type === "stage_change") {
              const stageMsg = message as unknown as StageChangeMessage;

              setState(prev => {
                // Update stages array - mark previous as completed, current as active
                const updatedStages = prev.stages.map(s => {
                  if (s.stage === stageMsg.stage) {
                    return {
                      ...s,
                      status: "active" as const,
                      startTime: stageMsg.timestamp,
                      description: stageMsg.description
                    };
                  } else if (s.status === "active") {
                    return {
                      ...s,
                      status: "completed" as const,
                      endTime: stageMsg.timestamp
                    };
                  }
                  return s;
                });

                // Add a step for the stage transition
                const stageLabels: Record<PipelineStage, string> = {
                  "orchestrator": "Orchestrator",
                  "planner": "Planner",
                  "web-search": "Web Search",
                  "analysis": "Analysis",
                  "report-writer": "Report Writer"
                };

                return {
                  ...prev,
                  currentStage: stageMsg.stage,
                  stages: updatedStages,
                  steps: [...prev.steps.map(s => ({ ...s, status: "completed" as const })), {
                    id: `stage-${stageMsg.stage}-${Date.now()}`,
                    type: "search" as const,
                    status: "in_progress" as const,
                    description: `${stageLabels[stageMsg.stage]}: ${stageMsg.description || "Processing..."}`,
                    timestamp: stageMsg.timestamp,
                    stage: stageMsg.stage
                  }]
                };
              });
              continue;
            }

            // Handle final result message - this contains the report
            if (message.type === "result" && message.result) {
              currentReport = message.result;
              setState(prev => ({
                ...prev,
                report: currentReport,
                sessionId: message.session_id || prev.sessionId
              }));
              continue;
            }

            // Handle status messages (sandbox progress)
            if (message.type === "status" && message.content) {
              setState(prev => ({
                ...prev,
                steps: [...prev.steps.map(s => ({ ...s, status: "completed" as const })), {
                  id: `status-${Date.now()}`,
                  type: "search" as const,
                  status: "in_progress" as const,
                  description: message.content!,
                  timestamp: Date.now()
                }]
              }));
              continue;
            }

            // Handle error messages
            if (message.type === "error" && message.content) {
              setState(prev => ({
                ...prev,
                status: "error",
                error: message.content
              }));
              continue;
            }

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
                } else if (block.name === "Task") {
                  // Subagent invocation
                  const input = toolInput as { subagent_type?: string; description?: string };
                  stepDescription = `Delegating to ${input.subagent_type || "subagent"}...`;
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
                    timestamp: Date.now(),
                    stage: prev.currentStage || undefined
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

      // Mark all stages as completed
      setState(prev => ({
        ...prev,
        status: "completed",
        currentStage: null,
        stages: prev.stages.map(s => ({
          ...s,
          status: "completed" as const,
          endTime: s.endTime || Date.now()
        })),
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
      currentStage: null,
      stages: createInitialStages(),
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
