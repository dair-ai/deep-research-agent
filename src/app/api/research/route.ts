import { query } from "@anthropic-ai/claude-agent-sdk";
import { NextRequest } from "next/server";
import { researchAgentConfig } from "@/lib/agent/config";
import { RESEARCH_PROMPT_TEMPLATE } from "@/lib/agent/prompts";

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

    const stream = new ReadableStream({
      async start(controller) {
        try {
          log("AGENT", "Starting agent query...");
          log("CONFIG", "Agent configuration:", researchAgentConfig);

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
                    } else if (block.type === "tool_use") {
                      toolCallCount++;
                      log("TOOL_CALL", `  Tool #${toolCallCount}: ${block.name}`, {
                        id: block.id,
                        input: block.input
                      });
                    }
                  });
                }
              }
            } else if (message.type === "result") {
              const resultData = message as Record<string, unknown>;
              log("RESULT", `Message #${messageCount} - Final result`, {
                subtype: message.subtype,
                duration_ms: message.duration_ms,
                num_turns: message.num_turns,
                total_cost_usd: message.total_cost_usd,
                session_id: message.session_id,
                result: resultData.result
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
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          log("ERROR", `Agent error: ${errorMessage}`);
          if (error instanceof Error && error.stack) {
            log("ERROR", `Stack trace: ${error.stack}`);
          }
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
