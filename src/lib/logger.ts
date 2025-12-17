import * as fs from "fs";
import * as path from "path";

/**
 * Research Session Logger
 *
 * Creates detailed markdown logs for each research session including:
 * - Planning output (queries and date ranges)
 * - Search executions
 * - Tool calls
 * - Token costs
 * - Final results
 */

export interface ToolCallLog {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  timestamp: string;
  duration_ms?: number;
}

export interface StageLog {
  stage: string;
  description: string;
  startTime: string;
  endTime?: string;
  duration_ms?: number;
}

export interface CostLog {
  input_tokens?: number;
  output_tokens?: number;
  total_cost_usd?: number;
}

export interface SessionLog {
  sessionId: string;
  topic: string;
  startTime: string;
  endTime?: string;
  currentDateTime: string;
  stages: StageLog[];
  toolCalls: ToolCallLog[];
  plannerOutput?: string;
  searchResults?: string;
  analysisOutput?: string;
  finalReport?: string;
  finalAgentOutput?: string;
  costs: CostLog;
  totalDuration_ms?: number;
  status: "in_progress" | "completed" | "error";
  error?: string;
}

export class ResearchLogger {
  private logsDir: string;
  private session: SessionLog;
  private logFilePath: string;

  constructor(topic: string, sessionId: string) {
    this.logsDir = path.join(process.cwd(), "logs");

    // Ensure logs directory exists
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const sanitizedTopic = topic.substring(0, 50).replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    this.logFilePath = path.join(this.logsDir, `${timestamp}_${sanitizedTopic}.md`);

    this.session = {
      sessionId,
      topic,
      startTime: new Date().toISOString(),
      currentDateTime: new Date().toISOString(),
      stages: [],
      toolCalls: [],
      costs: {},
      status: "in_progress"
    };

    this.writeLog();
  }

  /**
   * Log a stage transition
   */
  logStage(stage: string, description: string): void {
    // End previous stage if exists
    const lastStage = this.session.stages[this.session.stages.length - 1];
    if (lastStage && !lastStage.endTime) {
      lastStage.endTime = new Date().toISOString();
      lastStage.duration_ms = new Date(lastStage.endTime).getTime() - new Date(lastStage.startTime).getTime();
    }

    this.session.stages.push({
      stage,
      description,
      startTime: new Date().toISOString()
    });
    this.writeLog();
  }

  /**
   * Log a tool call
   */
  logToolCall(id: string, name: string, input: Record<string, unknown>): void {
    this.session.toolCalls.push({
      id,
      name,
      input,
      timestamp: new Date().toISOString()
    });
    this.writeLog();
  }

  /**
   * Log a tool call result/output
   */
  logToolResult(id: string, output: string): void {
    const toolCall = this.session.toolCalls.find(t => t.id === id);
    if (toolCall) {
      toolCall.output = output;
      this.writeLog();
    }
  }

  /**
   * Log planner output
   */
  logPlannerOutput(output: string): void {
    this.session.plannerOutput = output;
    this.writeLog();
  }

  /**
   * Log search results summary
   */
  logSearchResults(results: string): void {
    this.session.searchResults = results;
    this.writeLog();
  }

  /**
   * Log analysis output
   */
  logAnalysisOutput(output: string): void {
    this.session.analysisOutput = output;
    this.writeLog();
  }

  /**
   * Log final report
   */
  logFinalReport(report: string): void {
    this.session.finalReport = report;
    this.writeLog();
  }

  /**
   * Log the final agent output (complete result from the pipeline)
   */
  logFinalAgentOutput(output: string): void {
    this.session.finalAgentOutput = output;
    this.writeLog();
  }

  /**
   * Log costs and token usage
   */
  logCosts(costs: CostLog): void {
    this.session.costs = {
      ...this.session.costs,
      ...costs
    };
    this.writeLog();
  }

  /**
   * Mark session as complete
   */
  complete(totalDuration_ms?: number, totalCost?: number, numTurns?: number): void {
    this.session.status = "completed";
    this.session.endTime = new Date().toISOString();
    this.session.totalDuration_ms = totalDuration_ms;

    // End last stage
    const lastStage = this.session.stages[this.session.stages.length - 1];
    if (lastStage && !lastStage.endTime) {
      lastStage.endTime = new Date().toISOString();
      lastStage.duration_ms = new Date(lastStage.endTime).getTime() - new Date(lastStage.startTime).getTime();
    }

    if (totalCost !== undefined) {
      this.session.costs.total_cost_usd = totalCost;
    }

    this.writeLog();
  }

  /**
   * Mark session as error
   */
  logError(error: string): void {
    this.session.status = "error";
    this.session.error = error;
    this.session.endTime = new Date().toISOString();
    this.writeLog();
  }

  /**
   * Get the log file path
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }

  /**
   * Write the current session state to markdown file
   */
  private writeLog(): void {
    const md = this.generateMarkdown();
    fs.writeFileSync(this.logFilePath, md, "utf-8");
  }

  /**
   * Generate markdown content from session data
   */
  private generateMarkdown(): string {
    const { session } = this;
    const lines: string[] = [];

    // Header
    lines.push(`# Research Session Log`);
    lines.push(``);
    lines.push(`**Topic:** ${session.topic}`);
    lines.push(`**Session ID:** ${session.sessionId}`);
    lines.push(`**Status:** ${session.status.toUpperCase()}`);
    lines.push(`**Started:** ${session.startTime}`);
    if (session.endTime) {
      lines.push(`**Ended:** ${session.endTime}`);
    }
    if (session.totalDuration_ms) {
      lines.push(`**Duration:** ${(session.totalDuration_ms / 1000).toFixed(2)}s`);
    }
    lines.push(``);

    // Costs Summary
    lines.push(`## Costs & Usage`);
    lines.push(``);
    if (session.costs.total_cost_usd !== undefined) {
      lines.push(`- **Total Cost:** $${session.costs.total_cost_usd.toFixed(6)}`);
    }
    if (session.costs.input_tokens !== undefined) {
      lines.push(`- **Input Tokens:** ${session.costs.input_tokens.toLocaleString()}`);
    }
    if (session.costs.output_tokens !== undefined) {
      lines.push(`- **Output Tokens:** ${session.costs.output_tokens.toLocaleString()}`);
    }
    lines.push(`- **Tool Calls:** ${session.toolCalls.length}`);
    lines.push(``);

    // Pipeline Stages
    lines.push(`## Pipeline Stages`);
    lines.push(``);
    lines.push(`| Stage | Description | Duration |`);
    lines.push(`|-------|-------------|----------|`);
    for (const stage of session.stages) {
      const duration = stage.duration_ms ? `${(stage.duration_ms / 1000).toFixed(2)}s` : "In Progress";
      lines.push(`| ${stage.stage} | ${stage.description} | ${duration} |`);
    }
    lines.push(``);

    // Tool Calls
    lines.push(`## Tool Calls`);
    lines.push(``);
    for (let i = 0; i < session.toolCalls.length; i++) {
      const tool = session.toolCalls[i];
      lines.push(`### ${i + 1}. ${tool.name}`);
      lines.push(``);
      lines.push(`**Time:** ${tool.timestamp}`);
      lines.push(`**ID:** \`${tool.id}\``);
      lines.push(``);
      lines.push(`**Input:**`);
      lines.push("```json");
      lines.push(JSON.stringify(tool.input, null, 2));
      lines.push("```");
      lines.push(``);
      if (tool.output) {
        lines.push(`**Output:**`);
        lines.push("```");
        lines.push(tool.output);
        lines.push("```");
        lines.push(``);
      }
    }

    // Planner Output
    if (session.plannerOutput) {
      lines.push(`## Planner Output`);
      lines.push(``);
      lines.push(session.plannerOutput);
      lines.push(``);
    }

    // Search Results
    if (session.searchResults) {
      lines.push(`## Search Results Summary`);
      lines.push(``);
      lines.push(session.searchResults);
      lines.push(``);
    }

    // Analysis Output
    if (session.analysisOutput) {
      lines.push(`## Analysis Output`);
      lines.push(``);
      lines.push(session.analysisOutput);
      lines.push(``);
    }

    // Final Report
    if (session.finalReport) {
      lines.push(`## Final Report`);
      lines.push(``);
      lines.push(session.finalReport);
      lines.push(``);
    }

    // Final Agent Output (complete pipeline result)
    if (session.finalAgentOutput) {
      lines.push(`## Final Agent Output`);
      lines.push(``);
      lines.push(`The complete output from the research agent pipeline:`);
      lines.push(``);
      lines.push("```");
      lines.push(session.finalAgentOutput);
      lines.push("```");
      lines.push(``);
    }

    // Error
    if (session.error) {
      lines.push(`## Error`);
      lines.push(``);
      lines.push("```");
      lines.push(session.error);
      lines.push("```");
      lines.push(``);
    }

    // Footer
    lines.push(`---`);
    lines.push(`*Log generated at ${new Date().toISOString()}*`);

    return lines.join("\n");
  }
}

/**
 * Create a new research logger instance
 */
export function createResearchLogger(topic: string, sessionId: string): ResearchLogger {
  return new ResearchLogger(topic, sessionId);
}
