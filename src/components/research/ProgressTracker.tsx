"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ResearchStep, StageProgress, PipelineStage } from "@/types/research";

interface ProgressTrackerProps {
  steps: ResearchStep[];
  stages: StageProgress[];
  currentStage: PipelineStage | null;
  status: "idle" | "researching" | "completed" | "error";
}

const STAGE_CONFIG: { stage: PipelineStage; label: string; icon: React.ReactNode }[] = [
  {
    stage: "planner",
    label: "Planner",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    )
  },
  {
    stage: "web-search",
    label: "Search",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    )
  },
  {
    stage: "report-writer",
    label: "Report",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  }
];

export function ProgressTracker({ steps, stages, currentStage, status }: ProgressTrackerProps) {
  if (steps.length === 0 && stages.every(s => s.status === "pending")) return null;

  const getStageStatus = (stage: PipelineStage): StageProgress["status"] => {
    const stageProgress = stages.find(s => s.stage === stage);
    return stageProgress?.status || "pending";
  };

  const getStatusIcon = (stepStatus: ResearchStep["status"]) => {
    switch (stepStatus) {
      case "completed":
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "in_progress":
        return (
          <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="8" />
          </svg>
        );
    }
  };

  const getStepTypeColor = (type: ResearchStep["type"]) => {
    switch (type) {
      case "search":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "analyze":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "synthesize":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "complete":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            Research Progress
          </span>
          <Badge variant={status === "completed" ? "default" : "secondary"}>
            {status === "researching" ? "In Progress" : status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Pipeline Stage Indicator */}
        <div className="mb-4 pb-4 border-b">
          <div className="flex items-center justify-between">
            {STAGE_CONFIG.map((config, index) => {
              const stageStatus = getStageStatus(config.stage);
              const isActive = stageStatus === "active";
              const isCompleted = stageStatus === "completed";

              return (
                <div key={config.stage} className="flex items-center flex-1">
                  {/* Stage Node */}
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                        ${isCompleted
                          ? "bg-green-500 text-white"
                          : isActive
                            ? "bg-blue-500 text-white ring-4 ring-blue-200 dark:ring-blue-900"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                        }
                        ${isActive ? "animate-pulse" : ""}
                      `}
                    >
                      {isCompleted ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        config.icon
                      )}
                    </div>
                    <span className={`
                      mt-2 text-xs font-medium transition-colors
                      ${isActive ? "text-blue-600 dark:text-blue-400" : ""}
                      ${isCompleted ? "text-green-600 dark:text-green-400" : ""}
                      ${!isActive && !isCompleted ? "text-gray-500 dark:text-gray-400" : ""}
                    `}>
                      {config.label}
                    </span>
                  </div>

                  {/* Connector Line */}
                  {index < STAGE_CONFIG.length - 1 && (
                    <div className={`
                      h-0.5 flex-1 mx-2 transition-colors duration-300
                      ${isCompleted ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"}
                    `} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <ScrollArea className="h-[200px] pr-4">
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="flex items-start gap-3 text-sm"
              >
                <div className="mt-0.5 flex-shrink-0">
                  {getStatusIcon(step.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-xs ${getStepTypeColor(step.type)}`}>
                      {step.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground truncate">
                    {step.description}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className="absolute left-[22px] top-6 bottom-0 w-px bg-border" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
