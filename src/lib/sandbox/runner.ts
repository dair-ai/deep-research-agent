/**
 * Vercel Sandbox Runner for Research Agent
 *
 * Runs the Claude Agent SDK in an isolated container environment
 * to work around Vercel serverless limitations (no subprocess spawning).
 */

import { Sandbox } from "@vercel/sandbox";
import ms from "ms";

export interface SandboxMessage {
  type: "stdout" | "stderr" | "status" | "result" | "error";
  data: string;
  timestamp: number;
}

export interface RunResearchOptions {
  topic: string;
  sessionId?: string;
  anthropicApiKey: string;
  exaApiKey: string;
  onMessage?: (message: SandboxMessage) => void;
}

/**
 * The research script that runs inside the sandbox
 * This gets the agent SDK installed and runs the research pipeline
 */
function getResearchScript(topic: string, exaApiKey: string, sessionId?: string): string {
  const escapedTopic = topic.replace(/`/g, "\\`").replace(/\$/g, "\\$").replace(/"/g, '\\"');
  const sessionIdArg = sessionId ? `"${sessionId}"` : "undefined";

  return `
const { query, createSdkMcpServer, tool } = require("@anthropic-ai/claude-agent-sdk");
const { z } = require("zod");
const Exa = require("exa-js").default;

// API key passed from parent environment
const EXA_API_KEY = "${exaApiKey}";

// Initialize Exa client
let exaClient = null;
const getExaClient = () => {
  if (exaClient) return exaClient;
  console.log("[Exa] Creating client...");
  exaClient = new Exa(EXA_API_KEY);
  return exaClient;
};

// Create Exa search tools (same as local)
const exaSearchTools = createSdkMcpServer({
  name: "exa-research",
  version: "1.0.0",
  tools: [
    tool(
      "search",
      "Search the web using neural search.",
      {
        query: z.string().describe("Search query"),
        num_results: z.number().default(5).describe("Number of results"),
        start_published_date: z.string().optional().describe("Filter: published after (YYYY-MM-DD)"),
        end_published_date: z.string().optional().describe("Filter: published before (YYYY-MM-DD)")
      },
      async (args) => {
        console.log("[Exa] search:", args.query.substring(0, 50) + "...");
        try {
          const exa = getExaClient();
          const options = {
            type: "neural",
            numResults: args.num_results,
            useAutoprompt: true,
            contents: { text: { maxCharacters: 1500 } }
          };
          if (args.start_published_date) options.startPublishedDate = args.start_published_date;
          if (args.end_published_date) options.endPublishedDate = args.end_published_date;

          const results = await exa.searchAndContents(args.query, options);
          console.log("[Exa] search done:", results.results.length, "results");

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                query: args.query,
                total: results.results.length,
                results: results.results.map(r => ({
                  title: r.title || "Untitled",
                  url: r.url,
                  text: r.text || null
                }))
              }, null, 2)
            }]
          };
        } catch (error) {
          console.error("[Exa] search FAILED:", error.message);
          return { content: [{ type: "text", text: JSON.stringify({ error: true, message: error.message }) }] };
        }
      }
    ),
    tool(
      "get_contents",
      "Get full content from URLs.",
      {
        urls: z.array(z.string()).describe("URLs to fetch"),
        max_characters: z.number().default(3000).describe("Max chars per doc")
      },
      async (args) => {
        console.log("[Exa] get_contents:", args.urls.length, "urls");
        try {
          const exa = getExaClient();
          const contents = await exa.getContents(args.urls, { text: { maxCharacters: args.max_characters } });
          console.log("[Exa] get_contents done:", contents.results.length, "docs");

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                documents: contents.results.map(doc => ({
                  url: doc.url,
                  title: doc.title || "Untitled",
                  text: doc.text || "No content"
                }))
              }, null, 2)
            }]
          };
        } catch (error) {
          console.error("[Exa] get_contents FAILED:", error.message);
          return { content: [{ type: "text", text: JSON.stringify({ error: true, message: error.message }) }] };
        }
      }
    )
  ]
});

// Research configuration matching our multi-agent pipeline
const ORCHESTRATOR_PROMPT = \`You are a Research Orchestrator that coordinates a multi-agent research pipeline.

## Your Pipeline
You have 3 specialized subagents to delegate to in sequence:

1. **planner-agent**: Creates optimized search queries and date ranges
2. **web-search-agent**: Gathers sources from the web (has Exa search tools)
3. **report-writer-agent**: Writes the final research report from gathered sources

## Workflow
For EVERY research request, follow this exact sequence:

### Step 1: Planning
Announce: "STAGE: Planner - Creating optimized search strategy..."
Call planner-agent with topic and current date.

### Step 2: Web Search
Announce: "STAGE: WebSearch - Gathering sources from the web..."
Call web-search-agent with the search plan.

### Step 3: Report Writing
Announce: "STAGE: ReportWriter - Generating report..."
Call report-writer-agent with the gathered sources.

### Step 4: Deliver Report
Return the final markdown report.

ALWAYS use all 3 agents in sequence and announce each STAGE.\`;

// Subagent definitions
const SUBAGENTS = {
  "planner-agent": {
    description: "Creates 4 search queries with date ranges for a research topic.",
    tools: [],
    prompt: "You are a Research Planner. Create exactly 4 search queries for the given topic. Output JSON only with date_range and search_queries (4 queries, 3 results each).",
    model: "haiku"
  },
  "web-search-agent": {
    description: "Executes search queries and gathers sources using Exa tools.",
    tools: ["mcp__exa-research__search", "mcp__exa-research__get_contents"],
    prompt: "Execute the search plan provided. For each query, call the search tool with the date range. After ALL searches complete, pick the 6 best URLs and call get_contents ONCE. Return sources as a simple list with Title, URL, Content. Be fast and efficient.",
    model: "haiku"
  },
  "report-writer-agent": {
    description: "Writes the final research report from gathered sources.",
    tools: [],
    prompt: "You are a Research Report Writer. Create a concise report with 4 sections: Summary (2-3 paragraphs), Key Findings (3-5 paragraphs with citations [1], [2]), Conclusion (1-2 paragraphs), References ([1] Title - URL). Target 800-1200 words. Be concise and direct.",
    model: "haiku"
  }
};

const config = {
  model: "claude-haiku-4-5-20251001",
  systemPrompt: ORCHESTRATOR_PROMPT,
  mcpServers: {
    "exa-research": exaSearchTools
  },
  agents: SUBAGENTS,
  allowedTools: [
    "mcp__exa-research__search",
    "mcp__exa-research__get_contents"
  ],
  disallowedTools: ["WebFetch", "WebSearch"],
  permissionMode: "bypassPermissions"
};

const currentDateTime = new Date().toISOString();
const topic = "${escapedTopic}";
const prompt = \`Research the following topic thoroughly and provide a comprehensive report:

**Topic:** \${topic}

**Current Date/Time:** \${currentDateTime}

Please conduct deep research using multiple search queries, gather sources, analyze findings, and produce a well-structured research report with citations.\`;

async function runResearch() {
  try {
    for await (const message of query({
      prompt,
      options: {
        ...config,
        resume: ${sessionIdArg}
      }
    })) {
      // Output each message as JSON for parsing
      console.log("__RESEARCH_MSG__" + JSON.stringify(message));
    }
    console.log("__RESEARCH_DONE__");
  } catch (error) {
    console.error("__RESEARCH_ERROR__" + (error.message || String(error)));
    process.exit(1);
  }
}

runResearch();
`;
}

/**
 * Run research in a Vercel Sandbox
 * Returns an async generator that yields messages from the sandbox
 */
export async function* runResearchInSandbox(
  options: RunResearchOptions
): AsyncGenerator<SandboxMessage> {
  const { topic, sessionId, anthropicApiKey, exaApiKey, onMessage } = options;

  let sandbox: Sandbox | null = null;

  try {
    yield { type: "status", data: "Creating sandbox environment...", timestamp: Date.now() };

    // Build sandbox creation params
    const sandboxParams: {
      runtime: string;
      timeout: number;
      token?: string;
      projectId?: string;
      teamId?: string;
    } = {
      runtime: "node22",
      timeout: ms("5m"), // 5 minutes
    };

    // Add credentials if available (for explicit auth)
    // Support both VERCEL_TOKEN (official) and VERCEL_API_TOKEN (legacy)
    const token = process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN;
    if (token) {
      sandboxParams.token = token;
    }
    if (process.env.VERCEL_PROJECT_ID) {
      sandboxParams.projectId = process.env.VERCEL_PROJECT_ID;
    }
    if (process.env.VERCEL_TEAM_ID) {
      sandboxParams.teamId = process.env.VERCEL_TEAM_ID;
    }

    // Create sandbox with Node.js runtime
    sandbox = await Sandbox.create(sandboxParams);

    yield { type: "status", data: "Sandbox created, setting up project...", timestamp: Date.now() };

    // Use default working directory /vercel/sandbox (per docs)
    const workDir = "/vercel/sandbox";

    // Create a working directory with package.json for local npm install
    const packageJson = JSON.stringify({
      name: "research-runner",
      version: "1.0.0",
      type: "commonjs",
      dependencies: {
        "@anthropic-ai/claude-agent-sdk": "latest",
        "exa-js": "latest",
        "zod": "latest"
      }
    }, null, 2);

    // Write package.json and research script
    const script = getResearchScript(topic, exaApiKey, sessionId);

    yield { type: "status", data: "Writing project files...", timestamp: Date.now() };

    try {
      await sandbox.writeFiles([
        { path: `${workDir}/package.json`, content: Buffer.from(packageJson, "utf-8") },
        { path: `${workDir}/index.js`, content: Buffer.from(script, "utf-8") }
      ]);
    } catch (writeError) {
      const writeErrMsg = writeError instanceof Error ? writeError.message : String(writeError);
      yield { type: "error", data: `Failed to write files: ${writeErrMsg}`, timestamp: Date.now() };
      return;
    }

    yield { type: "status", data: "Installing dependencies...", timestamp: Date.now() };

    // Install dependencies locally (per docs example)
    const installResult = await sandbox.runCommand({
      cmd: "npm",
      args: ["install", "--loglevel", "info"],
      cwd: workDir,
      signal: AbortSignal.timeout(ms("2m")),
    });

    const installStdout = await installResult.stdout();
    const installStderr = await installResult.stderr();

    if (installResult.exitCode !== 0) {
      yield { type: "error", data: `npm install failed (exit ${installResult.exitCode}): ${installStderr || installStdout}`, timestamp: Date.now() };
      return;
    }

    yield { type: "status", data: `Dependencies installed, starting research...`, timestamp: Date.now() };

    // Run the research script from workDir where node_modules exists
    const command = await sandbox.runCommand({
      cmd: "node",
      args: ["index.js"],
      cwd: workDir,
      env: {
        ANTHROPIC_API_KEY: anthropicApiKey,
        EXA_API_KEY: exaApiKey,
        PATH: "/vercel/runtimes/node22/bin:/usr/local/bin:/usr/bin:/bin",
      },
      detached: true,
    });

    // Process the command output
    let buffer = "";
    const processLine = (line: string) => {
      if (line.startsWith("__RESEARCH_MSG__")) {
        try {
          const json = line.substring("__RESEARCH_MSG__".length);
          const msg: SandboxMessage = {
            type: "result",
            data: json,
            timestamp: Date.now()
          };
          onMessage?.(msg);
        } catch {
          // Non-JSON output, treat as status
          const msg: SandboxMessage = { type: "stdout", data: line, timestamp: Date.now() };
          onMessage?.(msg);
        }
      } else if (line.startsWith("__RESEARCH_DONE__")) {
        const msg: SandboxMessage = { type: "status", data: "Research complete", timestamp: Date.now() };
        onMessage?.(msg);
      } else if (line.startsWith("__RESEARCH_ERROR__")) {
        const error = line.substring("__RESEARCH_ERROR__".length);
        const msg: SandboxMessage = { type: "error", data: error, timestamp: Date.now() };
        onMessage?.(msg);
      } else if (line.trim()) {
        const msg: SandboxMessage = { type: "stdout", data: line, timestamp: Date.now() };
        onMessage?.(msg);
      }
    };

    // Wait for command to finish and get the result
    const finished = await command.wait();

    // Process stdout
    const stdout = await command.stdout();
    if (stdout) {
      buffer = stdout;
      const lines = buffer.split("\n");
      for (const line of lines) {
        if (line.trim()) {
          processLine(line);
        }
      }
    }

    // Process stderr if any - this often contains the actual error
    const stderr = await command.stderr();
    if (stderr) {
      const stderrMsg: SandboxMessage = { type: "stderr", data: stderr, timestamp: Date.now() };
      onMessage?.(stderrMsg);
      // Also yield stderr as error for visibility
      if (finished.exitCode !== 0) {
        yield { type: "error", data: `Script stderr: ${stderr}`, timestamp: Date.now() };
      }
    }

    if (finished.exitCode !== 0) {
      const errorDetails = stderr || stdout || "No output captured";
      yield { type: "error", data: `Research script failed (exit ${finished.exitCode}): ${errorDetails}`, timestamp: Date.now() };
    }

    yield { type: "status", data: "Sandbox cleanup complete", timestamp: Date.now() };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    yield { type: "error", data: errorMessage, timestamp: Date.now() };
  } finally {
    // Clean up sandbox
    if (sandbox) {
      try {
        await sandbox.stop();
      } catch {
        // Ignore stop errors
      }
    }
  }
}

/**
 * Check if we're running in a Vercel serverless environment
 */
export function isVercelEnvironment(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}
