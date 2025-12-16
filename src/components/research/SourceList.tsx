"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ResearchSource } from "@/types/research";

interface SourceListProps {
  sources: ResearchSource[];
}

export function SourceList({ sources }: SourceListProps) {
  if (sources.length === 0) return null;

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url;
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            Sources Found
          </span>
          <Badge variant="secondary">{sources.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[250px] pr-4">
          <div className="space-y-3">
            {sources.map((source, index) => (
              <a
                key={`${source.url}-${index}`}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate text-foreground">
                      {source.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {getDomain(source.url)}
                      </Badge>
                      {source.author && source.author !== "Unknown" && (
                        <span className="text-xs text-muted-foreground">
                          by {source.author}
                        </span>
                      )}
                      {source.publishedDate && source.publishedDate !== "Unknown" && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(source.publishedDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {source.snippet && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                        {source.snippet}...
                      </p>
                    )}
                  </div>
                  <svg
                    className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </div>
              </a>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
