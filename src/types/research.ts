/**
 * Pipeline Stages for Multi-Agent Research System
 */
export type PipelineStage = "orchestrator" | "planner" | "web-search" | "report-writer";

/**
 * Stage progress tracking
 */
export interface StageProgress {
  stage: PipelineStage;
  status: "pending" | "active" | "completed";
  startTime?: number;
  endTime?: number;
  description?: string;
}

/**
 * Stage change message sent via SSE
 */
export interface StageChangeMessage {
  type: "stage_change";
  stage: PipelineStage;
  timestamp: number;
  description?: string;
}

/**
 * Pipeline stage metadata for UI display
 */
export const PIPELINE_STAGES: { stage: PipelineStage; label: string; icon: string }[] = [
  { stage: "planner", label: "Planner", icon: "lightbulb" },
  { stage: "web-search", label: "Web Search", icon: "search" },
  { stage: "report-writer", label: "Report Writer", icon: "file-text" }
];

export interface ResearchSource {
  title: string;
  url: string;
  author?: string;
  publishedDate?: string;
  snippet?: string;
}

export interface ResearchStep {
  id: string;
  type: "search" | "analyze" | "synthesize" | "complete";
  status: "pending" | "in_progress" | "completed";
  description: string;
  sources?: ResearchSource[];
  timestamp: number;
  stage?: PipelineStage; // Which subagent created this step
}

export interface ResearchProgress {
  currentStep: string;
  steps: ResearchStep[];
  totalSources: number;
  status: "idle" | "researching" | "analyzing" | "completed" | "error";
  currentStage?: PipelineStage; // Currently active pipeline stage
  stages?: StageProgress[]; // All stage progress
}

export interface ResearchReport {
  title: string;
  summary: string;
  sections: ReportSection[];
  sources: ResearchSource[];
  generatedAt: string;
}

export interface ReportSection {
  heading: string;
  content: string;
}

export type AgentMessageType =
  | "system"
  | "assistant"
  | "tool_use"
  | "tool_result"
  | "progress"
  | "error"
  | "stage_change"; // New: pipeline stage transitions

export interface AgentMessage {
  type: AgentMessageType;
  subtype?: string;
  content?: string;
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_result?: string;
  progress?: ResearchProgress;
  stage?: PipelineStage; // For stage_change messages
}

/**
 * Research state for the frontend hook
 */
export interface ResearchState {
  status: "idle" | "researching" | "completed" | "error";
  currentStage: PipelineStage | null;
  stages: StageProgress[];
  steps: ResearchStep[];
  sources: ResearchSource[];
  report: string;
  sessionId?: string;
  error?: string;
}

/**
 * Helper to create initial stage progress array
 */
export function createInitialStages(): StageProgress[] {
  return [
    { stage: "planner", status: "pending" },
    { stage: "web-search", status: "pending" },
    { stage: "report-writer", status: "pending" }
  ];
}
