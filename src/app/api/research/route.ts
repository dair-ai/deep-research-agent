import { query } from "@anthropic-ai/claude-agent-sdk";
import { NextRequest } from "next/server";
import { researchAgentConfig } from "@/lib/agent/config";
import { RESEARCH_PROMPT_TEMPLATE } from "@/lib/agent/prompts";
import type { PipelineStage, StageChangeMessage } from "@/types/research";
import { runResearchInSandbox, isVercelEnvironment, type SandboxMessage } from "@/lib/sandbox";

export const maxDuration = 300; // 5 minutes max for deep research

/**
 * Detect pipeline stage transitions from orchestrator's text output
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

/**
 * Run research using Vercel Sandbox (for serverless environments)
 */
async function runResearchWithSandbox(
  topic: string,
  sessionId: string | undefined,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder
) {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const exaApiKey = process.env.EXA_API_KEY;

  if (!anthropicApiKey || !exaApiKey) {
    throw new Error("Missing required API keys (ANTHROPIC_API_KEY or EXA_API_KEY)");
  }

  let currentStage: PipelineStage | null = null;

  const emitStageChange = (stage: PipelineStage, description: string) => {
    if (stage !== currentStage) {
      currentStage = stage;
      const stageEvent: StageChangeMessage = {
        type: "stage_change",
        stage,
        timestamp: Date.now(),
        description
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(stageEvent)}\n\n`));
    }
  };

  const messageQueue: SandboxMessage[] = [];

  for await (const sandboxMsg of runResearchInSandbox({
    topic,
    sessionId,
    anthropicApiKey,
    exaApiKey,
    onMessage: (msg) => messageQueue.push(msg)
  })) {
    while (messageQueue.length > 0) {
      const queuedMsg = messageQueue.shift()!;
      processSandboxMessage(queuedMsg);
    }
    processSandboxMessage(sandboxMsg);
  }

  while (messageQueue.length > 0) {
    const queuedMsg = messageQueue.shift()!;
    processSandboxMessage(queuedMsg);
  }

  function processSandboxMessage(sandboxMsg: SandboxMessage) {
    if (sandboxMsg.type === "status") {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "status", content: sandboxMsg.data })}\n\n`));
    } else if (sandboxMsg.type === "result") {
      try {
        const message = JSON.parse(sandboxMsg.data);

        if (message.type === "assistant" && message.message?.content) {
          const content = message.message.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "text") {
                const stageChange = detectStageChange(block.text);
                if (stageChange) {
                  emitStageChange(stageChange.stage, stageChange.description);
                }
              } else if (block.type === "tool_use" && block.name === "Task" && block.input) {
                const input = block.input as { subagent_type?: string; description?: string };
                if (input.subagent_type) {
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
          }
        } else if (message.type === "result") {
          // Send the final result to frontend
          controller.enqueue(encoder.encode(`data: ${sandboxMsg.data}\n\n`));
        }
      } catch {
        // Ignore non-JSON results
      }
    } else if (sandboxMsg.type === "error") {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", content: sandboxMsg.data })}\n\n`));
    }
  }
}

/**
 * Run research using direct SDK call (for local development)
 */
async function runResearchDirect(
  topic: string,
  sessionId: string | undefined,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder
) {
  let currentStage: PipelineStage | null = null;

  const emitStageChange = (stage: PipelineStage, description: string) => {
    if (stage !== currentStage) {
      currentStage = stage;
      const stageEvent: StageChangeMessage = {
        type: "stage_change",
        stage,
        timestamp: Date.now(),
        description
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(stageEvent)}\n\n`));
    }
  };

  const prompt = RESEARCH_PROMPT_TEMPLATE(topic);

  for await (const message of query({
    prompt,
    options: {
      ...researchAgentConfig,
      resume: sessionId,
    }
  })) {
    if (message.type === "assistant") {
      if (message.message?.content) {
        const content = message.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text") {
              const stageChange = detectStageChange(block.text);
              if (stageChange) {
                emitStageChange(stageChange.stage, stageChange.description);
              }
            } else if (block.type === "tool_use" && block.name === "Task" && block.input) {
              const input = block.input as { subagent_type?: string; description?: string };
              if (input.subagent_type) {
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
        }
      }
    } else if (message.type === "result") {
      // Send the final result to frontend
      const data = JSON.stringify(message);
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { topic, sessionId } = await request.json();

    if (!topic || typeof topic !== "string") {
      return new Response(
        JSON.stringify({ error: "Topic is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (isVercelEnvironment()) {
            await runResearchWithSandbox(topic, sessionId, controller, encoder);
          } else {
            await runResearchDirect(topic, sessionId, controller, encoder);
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
