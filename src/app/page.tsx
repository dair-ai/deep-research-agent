"use client";

import { useResearchAgent } from "@/hooks/useResearchAgent";
import {
  ResearchInput,
  ProgressTracker,
  SourceList,
  ReportDisplay
} from "@/components/research";

export default function Home() {
  const {
    status,
    steps,
    sources,
    report,
    error,
    startResearch,
    cancelResearch,
    reset
  } = useResearchAgent();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Deep Research Agent
          </h1>
          <p className="text-muted-foreground text-lg">
            AI-powered comprehensive web research using Claude and Exa
          </p>
        </header>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Input and Progress */}
          <div className="lg:col-span-1 space-y-6">
            <ResearchInput
              onSubmit={startResearch}
              isLoading={status === "researching"}
              onCancel={cancelResearch}
            />

            {steps.length > 0 && (
              <ProgressTracker steps={steps} status={status} />
            )}

            {sources.length > 0 && (
              <SourceList sources={sources} />
            )}

            {error && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                <div className="flex items-center gap-2 font-medium mb-1">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Error
                </div>
                <p className="text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Right Column - Report */}
          <div className="lg:col-span-2">
            {(report || status === "researching") && (
              <ReportDisplay
                report={report}
                status={status}
                onReset={reset}
              />
            )}

            {status === "idle" && !report && (
              <div className="h-full flex items-center justify-center min-h-[400px] rounded-lg border-2 border-dashed border-muted-foreground/20">
                <div className="text-center text-muted-foreground">
                  <svg
                    className="w-16 h-16 mx-auto mb-4 opacity-50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-lg font-medium">No Research Yet</p>
                  <p className="text-sm mt-1">
                    Enter a topic to start your deep research
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            Powered by{" "}
            <a
              href="https://anthropic.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:underline"
            >
              Claude
            </a>
            {" "}and{" "}
            <a
              href="https://exa.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:underline"
            >
              Exa
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
