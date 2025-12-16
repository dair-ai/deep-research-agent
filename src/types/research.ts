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
}

export interface ResearchProgress {
  currentStep: string;
  steps: ResearchStep[];
  totalSources: number;
  status: "idle" | "researching" | "analyzing" | "completed" | "error";
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
  | "error";

export interface AgentMessage {
  type: AgentMessageType;
  subtype?: string;
  content?: string;
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_result?: string;
  progress?: ResearchProgress;
}
