import { query } from "@anthropic-ai/claude-agent-sdk";
import { NextRequest } from "next/server";
import { researchAgentConfig } from "@/lib/agent/config";
import { RESEARCH_PROMPT_TEMPLATE } from "@/lib/agent/prompts";
import { createResearchLogger, type ResearchLogger } from "@/lib/logger";
import type { PipelineStage, StageChangeMessage } from "@/types/research";

export const maxDuration = 300; // 5 minutes max for deep research

// Helper to format log messages with timestamps
function log(category: string, message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${category}]`;
  if (data !== undefined) {
    console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`${prefix} ${message}`);
  }
}

/**
 * Detect pipeline stage transitions from orchestrator's text output
 * The orchestrator emits "STAGE: Planner - ...", "STAGE: WebSearch - ...", etc.
 */
function detectStageChange(text: string): { stage: PipelineStage; description: string } | null {
  const stagePatterns: { pattern: RegExp; stage: PipelineStage }[] = [
    { pattern: /STAGE:\s*Planner\s*-\s*(.+)/i, stage: "planner" },
    { pattern: /STAGE:\s*WebSearch\s*-\s*(.+)/i, stage: "web-search" },
    { pattern: /STAGE:\s*Analysis\s*-\s*(.+)/i, stage: "analysis" },
    { pattern: /STAGE:\s*ReportWriter\s*-\s*(.+)/i, stage: "report-writer" }
  ];

  for (const { pattern, stage } of stagePatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        stage,
        description: match[1]?.trim() || `Starting ${stage} stage`
      };
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  log("REQUEST", `━━━ New research request [${requestId}] ━━━`);

  try {
    const { topic, sessionId } = await request.json();
    log("REQUEST", `Topic: "${topic}"`);
    log("REQUEST", `Session ID: ${sessionId || "new session"}`);

    if (!topic || typeof topic !== "string") {
      log("ERROR", "Invalid topic provided");
      return new Response(
        JSON.stringify({ error: "Topic is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const prompt = RESEARCH_PROMPT_TEMPLATE(topic);
    log("PROMPT", `Generated prompt (${prompt.length} chars)`);

    const encoder = new TextEncoder();
    let messageCount = 0;
    let toolCallCount = 0;
    let currentStage: PipelineStage | null = null;
    let lastSubagentType: string | null = null; // Track which subagent we're waiting for
    let lastToolCallId: string | null = null; // Track last tool call for result logging

    // Initialize the research logger
    const researchLogger = createResearchLogger(topic, sessionId || requestId);

    const stream = new ReadableStream({
      async start(controller) {
        // Helper to emit stage change events
        const emitStageChange = (stage: PipelineStage, description: string) => {
          if (stage !== currentStage) {
            currentStage = stage;
            const stageEvent: StageChangeMessage = {
              type: "stage_change",
              stage,
              timestamp: Date.now(),
              description
            };
            log("STAGE", `Pipeline stage: ${stage} - ${description}`);
            researchLogger.logStage(stage, description);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(stageEvent)}\n\n`));
          }
        };

        try {
          log("AGENT", "Starting multi-agent pipeline...");
          log("CONFIG", "Agent configuration:", {
            model: researchAgentConfig.model,
            agents: Object.keys(researchAgentConfig.agents || {}),
            allowedTools: researchAgentConfig.allowedTools
          });

          for await (const message of query({
            prompt,
            options: {
              ...researchAgentConfig,
              resume: sessionId,
            }
          })) {
            messageCount++;

            // Log based on message type
            if (message.type === "assistant") {
              log("ASSISTANT", `Message #${messageCount} - Assistant response`);
              if (message.message?.content) {
                const content = message.message.content;
                if (Array.isArray(content)) {
                  content.forEach((block, i) => {
                    if (block.type === "text") {
                      const preview = block.text.substring(0, 200);
                      log("ASSISTANT", `  Text block ${i + 1}: "${preview}${block.text.length > 200 ? '...' : ''}"`);

                      // Check for stage transitions in orchestrator output
                      const stageChange = detectStageChange(block.text);
                      if (stageChange) {
                        emitStageChange(stageChange.stage, stageChange.description);
                      }
                    } else if (block.type === "tool_use") {
                      toolCallCount++;
                      const toolId = block.id || `tool-${toolCallCount}`;
                      lastToolCallId = toolId;

                      log("TOOL_CALL", `  Tool #${toolCallCount}: ${block.name}`, {
                        id: block.id,
                        input: block.input
                      });

                      // Log tool call to file
                      researchLogger.logToolCall(
                        toolId,
                        block.name,
                        block.input as Record<string, unknown> || {}
                      );

                      // Detect subagent invocations via Task tool
                      if (block.name === "Task" && block.input) {
                        const input = block.input as { subagent_type?: string; description?: string };
                        if (input.subagent_type) {
                          lastSubagentType = input.subagent_type;
                          const agentStageMap: Record<string, PipelineStage> = {
                            "planner-agent": "planner",
                            "web-search-agent": "web-search",
                            "analysis-agent": "analysis",
                            "report-writer-agent": "report-writer"
                          };
                          const stage = agentStageMap[input.subagent_type];
                          if (stage) {
                            emitStageChange(stage, input.description || `Running ${input.subagent_type}`);
                          }
                        }
                      }
                    }
                  });
                }
              }
            } else if (message.type === "user" && message.tool_use_result) {
              // Capture tool outputs - complete, no truncation
              const result = typeof message.tool_use_result === "string"
                ? message.tool_use_result
                : JSON.stringify(message.tool_use_result, null, 2);

              // Log tool result to the last tool call
              if (lastToolCallId && result) {
                researchLogger.logToolResult(lastToolCallId, result);
                log("TOOL_RESULT", `  Result for ${lastToolCallId}: ${result.substring(0, 200)}${result.length > 200 ? '...' : ''}`);
              }

              // Also log to specific sections for subagent outputs (complete, no truncation)
              if (lastSubagentType && result && !result.startsWith("Error:")) {
                switch (lastSubagentType) {
                  case "planner-agent":
                    researchLogger.logPlannerOutput(result);
                    break;
                  case "web-search-agent":
                    researchLogger.logSearchResults(result);
                    break;
                  case "analysis-agent":
                    researchLogger.logAnalysisOutput(result);
                    break;
                  case "report-writer-agent":
                    researchLogger.logFinalReport(result);
                    break;
                }
                lastSubagentType = null;
              }
            } else if (message.type === "result") {
              const resultData = message as Record<string, unknown>;
              log("RESULT", `Message #${messageCount} - Final result`, {
                subtype: message.subtype,
                duration_ms: message.duration_ms,
                num_turns: message.num_turns,
                total_cost_usd: message.total_cost_usd,
                session_id: message.session_id,
                result: typeof resultData.result === 'string'
                  ? resultData.result.substring(0, 500) + '...'
                  : resultData.result
              });

              // Log the complete final agent output
              if (resultData.result) {
                const finalOutput = typeof resultData.result === 'string'
                  ? resultData.result
                  : JSON.stringify(resultData.result, null, 2);
                researchLogger.logFinalAgentOutput(finalOutput);
              }

              // Log costs to file
              researchLogger.logCosts({
                total_cost_usd: message.total_cost_usd
              });
            } else {
              log("MESSAGE", `Message #${messageCount} - Type: ${message.type}`, message);
            }

            // Send each message as a Server-Sent Event
            const data = JSON.stringify(message);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }

          // Signal completion
          log("COMPLETE", `━━━ Research complete [${requestId}] ━━━`);
          log("STATS", `Total messages: ${messageCount}, Tool calls: ${toolCallCount}`);
          log("LOG_FILE", `Session logged to: ${researchLogger.getLogFilePath()}`);

          // Complete the research log
          researchLogger.complete();

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          log("ERROR", `Agent error: ${errorMessage}`);
          if (error instanceof Error && error.stack) {
            log("ERROR", `Stack trace: ${error.stack}`);
          }

          // Log error to file
          researchLogger.logError(errorMessage);

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", content: errorMessage })}\n\n`)
          );
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log("ERROR", `Request error [${requestId}]: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
