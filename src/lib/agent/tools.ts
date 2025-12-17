import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import Exa from "exa-js";

// Initialize Exa client (lazy singleton)
let exaClient: Exa | null = null;

const getExaClient = () => {
  if (exaClient) {
    console.log("[Exa] Using existing client");
    return exaClient;
  }

  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    console.error("[Exa] EXA_API_KEY not set!");
    throw new Error("EXA_API_KEY environment variable is not set");
  }
  console.log("[Exa] Creating new client");
  exaClient = new Exa(apiKey);
  return exaClient;
};

// Helper to format error responses
const errorResponse = (error: unknown) => ({
  content: [{
    type: "text" as const,
    text: JSON.stringify({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error occurred"
    })
  }]
});

console.log("[Exa] Initializing MCP server...");

// Create Exa search tools for deep research
export const exaSearchTools = createSdkMcpServer({
  name: "exa-research",
  version: "1.0.0",
  tools: [
    // Neural/Keyword Search
    tool(
      "search",
      "Search the web using neural or keyword search. Neural search uses semantic understanding for research queries, keyword search matches exact terms.",
      {
        query: z.string().describe("Search query. Use natural language for comprehensive research"),
        type: z.enum(["neural", "keyword"]).default("neural").describe("Search type - neural for semantic, keyword for exact"),
        num_results: z.number().min(1).max(20).default(10).describe("Number of results to return"),
        include_domains: z.array(z.string()).optional().describe("Only include results from these domains"),
        exclude_domains: z.array(z.string()).optional().describe("Exclude results from these domains"),
        start_published_date: z.string().optional().describe("Filter: published after (YYYY-MM-DD)"),
        end_published_date: z.string().optional().describe("Filter: published before (YYYY-MM-DD)"),
        use_autoprompt: z.boolean().default(true).describe("Let Exa optimize the query"),
        include_text: z.boolean().default(true).describe("Include text snippets in results")
      },
      async (args) => {
        console.log(`[Exa] search: "${args.query.substring(0, 50)}..."`);
        try {
          const exa = getExaClient();

          const options: Record<string, unknown> = {
            type: args.type,
            numResults: args.num_results,
            useAutoprompt: args.use_autoprompt
          };

          if (args.include_domains?.length) options.includeDomains = args.include_domains;
          if (args.exclude_domains?.length) options.excludeDomains = args.exclude_domains;
          if (args.start_published_date) options.startPublishedDate = args.start_published_date;
          if (args.end_published_date) options.endPublishedDate = args.end_published_date;
          if (args.include_text) options.contents = { text: { maxCharacters: 1500 } };

          const results = await exa.searchAndContents(args.query, options);
          console.log(`[Exa] search done: ${results.results.length} results`);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                query: args.query,
                total: results.results.length,
                results: results.results.map((r) => ({
                  title: r.title || "Untitled",
                  url: r.url,
                  author: r.author || "Unknown",
                  published_date: r.publishedDate || "Unknown",
                  text: (r as { text?: string }).text || null
                }))
              }, null, 2)
            }]
          };
        } catch (error) {
          console.error("[Exa] search FAILED:", error);
          return errorResponse(error);
        }
      }
    ),

    // Get full content from URLs
    tool(
      "get_contents",
      "Get full content from specific URLs for deep analysis. Use after initial search to get detailed information.",
      {
        urls: z.array(z.string()).min(1).max(10).describe("URLs to fetch full content from"),
        max_characters: z.number().min(500).max(10000).default(3000).describe("Max characters to retrieve per document")
      },
      async (args) => {
        console.log(`[Exa] get_contents: ${args.urls.length} urls`);
        try {
          const exa = getExaClient();

          const contents = await exa.getContents(args.urls, {
            text: { maxCharacters: args.max_characters }
          });
          console.log(`[Exa] get_contents done: ${contents.results.length} docs`);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                documents: contents.results.map((doc) => ({
                  url: doc.url,
                  title: doc.title || "Untitled",
                  author: doc.author || "Unknown",
                  text: (doc as { text?: string }).text || "No content available"
                }))
              }, null, 2)
            }]
          };
        } catch (error) {
          console.error("[Exa] get_contents FAILED:", error);
          return errorResponse(error);
        }
      }
    ),

    // Find similar content
    tool(
      "find_similar",
      "Find content similar to a given URL. Useful for expanding research from a key source.",
      {
        url: z.string().url().describe("URL to find similar content for"),
        num_results: z.number().min(1).max(20).default(5).describe("Number of similar results"),
        exclude_source_domain: z.boolean().default(true).describe("Exclude results from same domain as source")
      },
      async (args) => {
        console.log(`[Exa] find_similar: ${args.url.substring(0, 50)}...`);
        try {
          const exa = getExaClient();

          const results = await exa.findSimilar(args.url, {
            numResults: args.num_results,
            excludeSourceDomain: args.exclude_source_domain
          });
          console.log(`[Exa] find_similar done: ${results.results.length} results`);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                source_url: args.url,
                similar: results.results.map((r) => ({
                  title: r.title || "Untitled",
                  url: r.url,
                  author: r.author || "Unknown"
                }))
              }, null, 2)
            }]
          };
        } catch (error) {
          console.error("[Exa] find_similar FAILED:", error);
          return errorResponse(error);
        }
      }
    )
  ]
});
