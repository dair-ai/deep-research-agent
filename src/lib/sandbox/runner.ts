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
function getResearchScript(topic: string, sessionId?: string): string {
  const escapedTopic = topic.replace(/`/g, "\\`").replace(/\$/g, "\\$").replace(/"/g, '\\"');
  const sessionIdArg = sessionId ? `"${sessionId}"` : "undefined";

  return `
const { query } = require("@anthropic-ai/claude-agent-sdk");

// Research configuration matching our multi-agent pipeline
const ORCHESTRATOR_PROMPT = \`You are a Research Orchestrator that coordinates a multi-agent research pipeline.

## Your Pipeline
You have 4 specialized subagents to delegate to in sequence:

1. **planner-agent**: Creates optimized search queries and date ranges
2. **web-search-agent**: Gathers sources from the web (has Exa search tools)
3. **analysis-agent**: Analyzes gathered sources and extracts key findings
4. **report-writer-agent**: Writes the final comprehensive research report

## Workflow
For EVERY research request, follow this exact sequence:

### Step 1: Planning
Announce: "STAGE: Planner - Creating optimized search strategy..."
Call planner-agent with topic and current date.

### Step 2: Web Search
Announce: "STAGE: WebSearch - Gathering sources from the web..."
Call web-search-agent with the search plan.

### Step 3: Analysis
Announce: "STAGE: Analysis - Analyzing findings and extracting insights..."
Call analysis-agent with gathered sources.

### Step 4: Report Writing
Announce: "STAGE: ReportWriter - Generating comprehensive report..."
Call report-writer-agent with the analysis.

### Step 5: Deliver Report
Return the final markdown report.

ALWAYS use all 4 agents in sequence and announce each STAGE.\`;

const config = {
  model: "claude-haiku-4-5-20251001",
  systemPrompt: ORCHESTRATOR_PROMPT,
  mcpServers: {
    "exa-research": {
      type: "stdio",
      command: "npx",
      args: ["-y", "exa-mcp-server"],
      env: {
        EXA_API_KEY: process.env.EXA_API_KEY
      }
    }
  },
  allowedTools: [
    "mcp__exa-research__search",
    "mcp__exa-research__get_contents",
    "mcp__exa-research__find_similar"
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

    // Create working directory in /tmp (guaranteed to exist)
    const mkdirResult = await sandbox.runCommand("mkdir", ["-p", "/tmp/research"]);
    if (mkdirResult.exitCode !== 0) {
      const mkdirErr = await mkdirResult.stderr();
      yield { type: "error", data: `Failed to create directory: ${mkdirErr}`, timestamp: Date.now() };
      return;
    }

    // Create a working directory with package.json for local npm install
    const packageJson = JSON.stringify({
      name: "research-runner",
      version: "1.0.0",
      type: "commonjs",
      dependencies: {
        "@anthropic-ai/claude-agent-sdk": "latest",
        "exa-mcp-server": "latest"
      }
    }, null, 2);

    // Write package.json and research script
    const script = getResearchScript(topic, sessionId);

    yield { type: "status", data: "Writing project files...", timestamp: Date.now() };

    try {
      await sandbox.writeFiles([
        { path: "/tmp/research/package.json", content: Buffer.from(packageJson, "utf-8") },
        { path: "/tmp/research/index.js", content: Buffer.from(script, "utf-8") }
      ]);
    } catch (writeError) {
      const writeErrMsg = writeError instanceof Error ? writeError.message : String(writeError);
      yield { type: "error", data: `Failed to write files: ${writeErrMsg}`, timestamp: Date.now() };
      return;
    }

    yield { type: "status", data: "Installing dependencies...", timestamp: Date.now() };

    // Install dependencies locally
    const installResult = await sandbox.runCommand({
      cmd: "npm",
      args: ["install"],
      cwd: "/tmp/research",
      signal: AbortSignal.timeout(ms("2m")),
    });

    const installStdout = await installResult.stdout();
    const installStderr = await installResult.stderr();

    if (installResult.exitCode !== 0) {
      yield { type: "error", data: `npm install failed (exit ${installResult.exitCode}): ${installStderr || installStdout}`, timestamp: Date.now() };
      return;
    }

    yield { type: "status", data: `Dependencies installed (${installStdout?.split('\n').length || 0} packages), starting research...`, timestamp: Date.now() };

    // Run the research script from /tmp/research where node_modules exists
    const command = await sandbox.runCommand({
      cmd: "node",
      args: ["index.js"],
      cwd: "/tmp/research",
      env: {
        ANTHROPIC_API_KEY: anthropicApiKey,
        EXA_API_KEY: exaApiKey,
        PATH: "/usr/local/bin:/usr/bin:/bin",
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
