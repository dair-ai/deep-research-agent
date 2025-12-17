import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { ResearchLogger, createResearchLogger } from "@/lib/logger";

// Set to true to keep all test logs in the logs folder
const KEEP_TEST_LOGS = process.env.KEEP_TEST_LOGS === "true";

describe("ResearchLogger", () => {
  const testLogsDir = path.join(process.cwd(), "logs");
  let logger: ResearchLogger;
  let logFilePath: string;

  beforeEach(() => {
    // Create a new logger for each test
    logger = createResearchLogger("Test research topic", "test-session-123");
    logFilePath = logger.getLogFilePath();
  });

  afterEach(() => {
    // Clean up test log files unless KEEP_TEST_LOGS is set
    if (!KEEP_TEST_LOGS && fs.existsSync(logFilePath)) {
      fs.unlinkSync(logFilePath);
    }
  });

  describe("initialization", () => {
    it("should create logs directory if it does not exist", () => {
      expect(fs.existsSync(testLogsDir)).toBe(true);
    });

    it("should create a log file on initialization", () => {
      expect(fs.existsSync(logFilePath)).toBe(true);
    });

    it("should include topic in log file name", () => {
      expect(logFilePath).toContain("test-research-topic");
    });

    it("should initialize with in_progress status", () => {
      const content = fs.readFileSync(logFilePath, "utf-8");
      expect(content).toContain("**Status:** IN_PROGRESS");
    });

    it("should include topic in log content", () => {
      const content = fs.readFileSync(logFilePath, "utf-8");
      expect(content).toContain("**Topic:** Test research topic");
    });

    it("should include session ID in log content", () => {
      const content = fs.readFileSync(logFilePath, "utf-8");
      expect(content).toContain("**Session ID:** test-session-123");
    });
  });

  describe("logStage", () => {
    it("should log a stage transition", () => {
      logger.logStage("planner", "Creating optimized search strategy");

      const content = fs.readFileSync(logFilePath, "utf-8");
      expect(content).toContain("| planner |");
      expect(content).toContain("Creating optimized search strategy");
    });

    it("should log multiple stages", () => {
      logger.logStage("planner", "Planning search");
      logger.logStage("web-search", "Gathering sources");
      logger.logStage("analysis", "Analyzing findings");

      const content = fs.readFileSync(logFilePath, "utf-8");
      expect(content).toContain("| planner |");
      expect(content).toContain("| web-search |");
      expect(content).toContain("| analysis |");
    });

    it("should calculate duration for completed stages", async () => {
      logger.logStage("planner", "Planning");
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait 100ms
      logger.logStage("web-search", "Searching");

      const content = fs.readFileSync(logFilePath, "utf-8");
      // Planner stage should have duration, web-search should show "In Progress"
      expect(content).toMatch(/planner.*\d+\.\d+s/);
    });
  });

  describe("logToolCall", () => {
    it("should log a tool call with input", () => {
      logger.logToolCall("tool-123", "mcp__exa-research__search", {
        query: "quantum computing",
        num_results: 10,
      });

      const content = fs.readFileSync(logFilePath, "utf-8");
      expect(content).toContain("### 1. mcp__exa-research__search");
      expect(content).toContain('"query": "quantum computing"');
      expect(content).toContain('"num_results": 10');
    });

    it("should log multiple tool calls with incrementing numbers", () => {
      logger.logToolCall("tool-1", "Task", { subagent_type: "planner-agent" });
      logger.logToolCall("tool-2", "mcp__exa-research__search", { query: "AI" });
      logger.logToolCall("tool-3", "mcp__exa-research__get_contents", { urls: ["http://example.com"] });

      const content = fs.readFileSync(logFilePath, "utf-8");
      expect(content).toContain("### 1. Task");
      expect(content).toContain("### 2. mcp__exa-research__search");
      expect(content).toContain("### 3. mcp__exa-research__get_contents");
    });

    it("should log tool call with output/result", () => {
      logger.logToolCall("tool-search-1", "mcp__exa-research__search", {
        query: "context engineering",
        num_results: 5,
      });
      logger.logToolResult("tool-search-1", JSON.stringify({
        results: [
          { title: "Context Engineering Guide", url: "https://example.com/1" },
          { title: "Advanced Context Techniques", url: "https://example.com/2" }
        ]
      }, null, 2));

      const content = fs.readFileSync(logFilePath, "utf-8");
      expect(content).toContain("**Output:**");
      expect(content).toContain("Context Engineering Guide");
      expect(content).toContain("Advanced Context Techniques");
    });
  });

  describe("logPlannerOutput", () => {
    it("should log planner output", () => {
      const plannerOutput = JSON.stringify({
        date_range: {
          start_published_date: "2024-06-01",
          end_published_date: "2024-12-17",
        },
        search_queries: [
          { query: "quantum computing advances 2024", purpose: "recent developments" },
        ],
      }, null, 2);

      logger.logPlannerOutput(plannerOutput);

      const content = fs.readFileSync(logFilePath, "utf-8");
      expect(content).toContain("## Planner Output");
      expect(content).toContain("start_published_date");
      expect(content).toContain("quantum computing advances 2024");
    });
  });

  describe("logSearchResults", () => {
    it("should log search results summary", () => {
      const searchResults = `
### GATHERED SOURCES
**Topic**: Quantum Computing
**Sources Collected**: 15
1. **Quantum Supremacy Achieved** - https://example.com/quantum
`;
      logger.logSearchResults(searchResults);

      const content = fs.readFileSync(logFilePath, "utf-8");
      expect(content).toContain("## Search Results Summary");
      expect(content).toContain("GATHERED SOURCES");
      expect(content).toContain("Quantum Supremacy Achieved");
    });
  });

  describe("logAnalysisOutput", () => {
    it("should log analysis output", () => {
      const analysisOutput = `
### ANALYSIS RESULTS
**Major Themes**:
1. Quantum error correction
2. Quantum advantage demonstrations
`;
      logger.logAnalysisOutput(analysisOutput);

      const content = fs.readFileSync(logFilePath, "utf-8");
      expect(content).toContain("## Analysis Output");
      expect(content).toContain("ANALYSIS RESULTS");
      expect(content).toContain("Quantum error correction");
    });
  });

  describe("logFinalReport", () => {
    it("should log final report", () => {
      const report = `
# Quantum Computing Research Report

## Executive Summary
This report covers the latest advances in quantum computing...

## Key Findings
1. Major breakthrough in error correction
2. New quantum processors announced
`;
      logger.logFinalReport(report);

      const content = fs.readFileSync(logFilePath, "utf-8");
      expect(content).toContain("## Final Report");
      expect(content).toContain("Quantum Computing Research Report");
      expect(content).toContain("Executive Summary");
    });
  });

  describe("logFinalAgentOutput", () => {
    it("should log the complete final agent output", () => {
      const finalOutput = `Here is my comprehensive research report on quantum computing...

# Quantum Computing: Current State and Future Directions

## Executive Summary
This research covers the latest developments in quantum computing from major players including IBM, Google, and IonQ.

## Key Findings
1. Quantum error correction has seen major advances
2. New quantum processors reaching 1000+ qubits
3. Hybrid classical-quantum algorithms showing promise

## Conclusion
Quantum computing continues to advance rapidly with real-world applications emerging.`;

      logger.logFinalAgentOutput(finalOutput);

      const content = fs.readFileSync(logFilePath, "utf-8");
      expect(content).toContain("## Final Agent Output");
      expect(content).toContain("complete output from the research agent pipeline");
      expect(content).toContain("Quantum Computing: Current State and Future Directions");
      expect(content).toContain("Quantum error correction has seen major advances");
    });
  });

  describe("logCosts", () => {
    it("should log cost information", () => {
      logger.logCosts({
        total_cost_usd: 0.0523,
        input_tokens: 15000,
        output_tokens: 5000,
      });

      const content = fs.readFileSync(logFilePath, "utf-8");
      expect(content).toContain("$0.052300");
      expect(content).toContain("15,000");
      expect(content).toContain("5,000");
    });
  });

  describe("complete", () => {
    it("should mark session as completed", () => {
      logger.complete();

      const content = fs.readFileSync(logFilePath, "utf-8");
      expect(content).toContain("**Status:** COMPLETED");
    });

    it("should include duration when provided", () => {
      logger.complete(45230); // 45.23 seconds

      const content = fs.readFileSync(logFilePath, "utf-8");
      expect(content).toContain("**Duration:** 45.23s");
    });

    it("should include total cost when provided", () => {
      logger.complete(30000, 0.085);

      const content = fs.readFileSync(logFilePath, "utf-8");
      expect(content).toContain("$0.085000");
    });
  });

  describe("logError", () => {
    it("should log error and mark status as error", () => {
      logger.logError("Connection timeout to Exa API");

      const content = fs.readFileSync(logFilePath, "utf-8");
      expect(content).toContain("**Status:** ERROR");
      expect(content).toContain("## Error");
      expect(content).toContain("Connection timeout to Exa API");
    });
  });

  describe("full pipeline logging", () => {
    it("should log a complete research session", () => {
      // Simulate a full research pipeline
      logger.logStage("planner", "Creating search strategy");
      logger.logToolCall("t1", "Task", { subagent_type: "planner-agent" });

      logger.logPlannerOutput(JSON.stringify({
        date_range: { start: "2024-01-01", end: "2024-12-17" },
        queries: ["AI research 2024"],
      }));

      logger.logStage("web-search", "Gathering sources");
      logger.logToolCall("t2", "mcp__exa-research__search", { query: "AI research" });

      logger.logSearchResults("Found 10 sources about AI research");

      logger.logStage("analysis", "Analyzing findings");
      logger.logAnalysisOutput("Key themes: ML, LLMs, Safety");

      logger.logStage("report-writer", "Generating report");
      logger.logFinalReport("# AI Research Report\n\n## Summary\n...");

      logger.logCosts({ total_cost_usd: 0.05 });
      logger.complete(60000);

      const content = fs.readFileSync(logFilePath, "utf-8");

      // Verify all sections are present
      expect(content).toContain("## Pipeline Stages");
      expect(content).toContain("## Tool Calls");
      expect(content).toContain("## Planner Output");
      expect(content).toContain("## Search Results Summary");
      expect(content).toContain("## Analysis Output");
      expect(content).toContain("## Final Report");
      expect(content).toContain("## Costs & Usage");
      expect(content).toContain("**Status:** COMPLETED");
    });
  });
});

describe("createResearchLogger", () => {
  it("should create a ResearchLogger instance", () => {
    const logger = createResearchLogger("Test topic", "session-456");
    expect(logger).toBeInstanceOf(ResearchLogger);

    // Clean up
    const logPath = logger.getLogFilePath();
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
    }
  });

  it("should sanitize topic for filename", () => {
    const logger = createResearchLogger("What's the latest in AI/ML?", "session-789");
    const logPath = logger.getLogFilePath();
    const filename = path.basename(logPath);

    // Check the filename (not full path) doesn't contain special chars
    expect(filename).not.toContain("?");
    expect(filename).not.toContain("'");
    expect(filename).toContain("what-s-the-latest-in-ai-ml-");

    // Clean up
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
    }
  });
});

/**
 * Integration test that creates a complete research log and ALWAYS saves it
 * to the logs folder. This simulates a full research pipeline execution.
 */
describe("Integration: Full Research Pipeline Log", () => {
  it("should create and save a complete research session log", async () => {
    const topic = "Do some research on the latest context engineering techniques from companies like Anthropic, Manus, OpenAI, and Google";
    const sessionId = `test-integration-${Date.now()}`;

    const logger = createResearchLogger(topic, sessionId);
    const logPath = logger.getLogFilePath();

    // Stage 1: Planner
    logger.logStage("planner", "Creating optimized search strategy...");
    logger.logToolCall("toolu_planner_001", "Task", {
      subagent_type: "planner-agent",
      description: "Create optimized search queries for context engineering",
      prompt: "Create an optimized search plan for researching context engineering techniques..."
    });

    // Simulate planner output
    const plannerOutput = JSON.stringify({
      topic_analysis: {
        topic: "Latest context engineering techniques from AI companies",
        type: "ongoing_developments",
        reasoning: "Context engineering is a rapidly evolving field"
      },
      date_range: {
        start_published_date: "2024-06-01",
        end_published_date: "2025-12-17"
      },
      search_queries: [
        { query: "context engineering techniques AI 2024 2025", purpose: "Broad overview", num_results: 15 },
        { query: "Anthropic context window optimization", purpose: "Company-specific", num_results: 12 },
        { query: "OpenAI prompt engineering best practices", purpose: "Company-specific", num_results: 12 },
        { query: "Google Gemini long context techniques", purpose: "Company-specific", num_results: 12 },
        { query: "Manus AI context management", purpose: "Company-specific", num_results: 10 }
      ]
    }, null, 2);
    logger.logPlannerOutput(plannerOutput);

    // Log planner tool output
    logger.logToolResult("toolu_planner_001", plannerOutput);

    // Stage 2: Web Search
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate time passing
    logger.logStage("web-search", "Gathering sources from the web...");

    logger.logToolCall("toolu_search_001", "Task", {
      subagent_type: "web-search-agent",
      description: "Execute search plan and gather sources"
    });

    logger.logToolCall("toolu_exa_001", "mcp__exa-research__search", {
      query: "context engineering techniques AI 2024 2025",
      type: "neural",
      num_results: 15,
      start_published_date: "2024-06-01",
      end_published_date: "2025-12-17",
      include_text: true
    });

    // Log Exa search result (complete output)
    const exaSearchResult1 = JSON.stringify({
      results: [
        {
          title: "Context Engineering: The New Frontier",
          url: "https://anthropic.com/blog/context-engineering",
          publishedDate: "2024-11-15",
          text: "Context engineering represents a paradigm shift in how we design AI systems. By carefully crafting the information provided to language models, we can dramatically improve their performance on complex tasks. This guide covers the fundamental principles of context engineering, including: 1) Strategic context organization - structuring information hierarchically for optimal model comprehension. 2) Dynamic context injection - techniques for real-time context updates in agentic systems. 3) Context window optimization - maximizing the utility of available context space."
        },
        {
          title: "Building Better Prompts with Context",
          url: "https://openai.com/research/context-prompts",
          publishedDate: "2024-10-22",
          text: "Our research shows that structured context improves model performance by 40%. Key findings include: proper context framing, strategic information ordering, and the use of explicit section markers. We introduce a new framework called 'Contextual Prompt Engineering' (CPE) that combines traditional prompt engineering with advanced context management techniques."
        },
        {
          title: "Google's Approach to Long Context",
          url: "https://research.google/context-windows",
          publishedDate: "2024-09-18",
          text: "Gemini's 1M token context window enables new use cases previously impossible with smaller context limits. Our research team has developed novel attention mechanisms that maintain performance even with extremely long contexts. This paper presents our findings on context scaling, including techniques for efficient retrieval within large context windows."
        }
      ],
      totalResults: 15,
      autopromptString: "context engineering AI techniques 2024"
    }, null, 2);
    logger.logToolResult("toolu_exa_001", exaSearchResult1);

    logger.logToolCall("toolu_exa_002", "mcp__exa-research__search", {
      query: "Anthropic context window optimization extended context",
      type: "neural",
      num_results: 12,
      start_published_date: "2024-06-01",
      end_published_date: "2025-12-17",
      include_text: true
    });

    // Log second Exa search result
    const exaSearchResult2 = JSON.stringify({
      results: [
        {
          title: "Claude's Extended Context Capabilities",
          url: "https://anthropic.com/claude-context",
          publishedDate: "2024-12-01",
          text: "With 200K token context windows, Claude can process entire codebases, long documents, and complex multi-turn conversations. This technical report details our approach to training models for extended context understanding, including architectural innovations and training methodologies that enable superior performance on long-context tasks."
        },
        {
          title: "Constitutional AI and Context",
          url: "https://anthropic.com/constitutional-ai",
          publishedDate: "2024-08-15",
          text: "How Constitutional AI principles guide context handling and ensure safe, helpful responses even with complex or adversarial context. We present our framework for context safety, which includes techniques for detecting and handling potentially harmful context patterns while maintaining helpful behavior."
        }
      ],
      totalResults: 12,
      autopromptString: "Anthropic Claude context optimization"
    }, null, 2);
    logger.logToolResult("toolu_exa_002", exaSearchResult2);

    const searchResults = `
### GATHERED SOURCES
**Topic**: Context Engineering Techniques
**Sources Collected**: 25

**Query 1: context engineering techniques AI 2024 2025**
1. **Context Engineering: The New Frontier** - https://anthropic.com/blog/context-engineering
   - Published: 2024-11-15
   - Snippet: "Context engineering represents a paradigm shift in how we design AI systems..."

2. **Building Better Prompts with Context** - https://openai.com/research/context-prompts
   - Published: 2024-10-22
   - Snippet: "Our research shows that structured context improves model performance by 40%..."

3. **Google's Approach to Long Context** - https://research.google/context-windows
   - Published: 2024-09-18
   - Snippet: "Gemini's 1M token context window enables new use cases..."

**Query 2: Anthropic context window optimization**
4. **Claude's Extended Context Capabilities** - https://anthropic.com/claude-context
   - Published: 2024-12-01
   - Snippet: "With 200K token context windows, Claude can process entire codebases..."

5. **Constitutional AI and Context** - https://anthropic.com/constitutional-ai
   - Published: 2024-08-15
   - Snippet: "How Constitutional AI principles guide context handling..."
`;
    logger.logSearchResults(searchResults);

    // Stage 3: Analysis
    await new Promise(resolve => setTimeout(resolve, 50));
    logger.logStage("analysis", "Analyzing findings and extracting insights...");

    logger.logToolCall("toolu_analysis_001", "Task", {
      subagent_type: "analysis-agent",
      description: "Analyze context engineering research findings"
    });

    const analysisOutput = `
### ANALYSIS RESULTS

**Key Themes Identified:**
1. **Extended Context Windows** - All major companies pushing beyond 100K tokens
2. **RAG vs Native Context** - Trade-offs between retrieval and native context
3. **Context Engineering as Discipline** - Emerging best practices and methodologies
4. **Agentic Context Management** - Dynamic context for autonomous systems

**Company Comparison:**

| Company | Max Context | Key Innovation |
|---------|-------------|----------------|
| Anthropic | 200K tokens | Constitutional AI context handling |
| OpenAI | 128K tokens | Structured prompt engineering |
| Google | 1M+ tokens | Gemini long-context processing |
| Manus | Dynamic | Agentic context injection |

**Major Findings:**
1. Context engineering is becoming a distinct discipline separate from prompt engineering
2. Companies are investing heavily in context window expansion
3. RAG and native context are complementary, not competing approaches
4. Agentic systems require new context management strategies
`;
    logger.logAnalysisOutput(analysisOutput);

    // Stage 4: Report Writer
    await new Promise(resolve => setTimeout(resolve, 50));
    logger.logStage("report-writer", "Generating comprehensive report...");

    logger.logToolCall("toolu_report_001", "Task", {
      subagent_type: "report-writer-agent",
      description: "Generate final research report"
    });

    const finalReport = `
# Context Engineering Techniques: A Comprehensive Research Report

## Executive Summary

Context engineering has emerged as one of the most significant developments in artificial intelligence over the past eighteen months [1, 5]. This report examines the latest techniques and innovations from leading AI companies including Anthropic, OpenAI, Google, and Manus, drawing on 25 authoritative sources published between June 2024 and December 2025.

The research reveals that context engineering is rapidly establishing itself as a distinct discipline, separate from but complementary to traditional prompt engineering [5]. Major AI laboratories are investing heavily in two parallel tracks: expanding raw context window capabilities and developing sophisticated techniques for managing that context effectively. Anthropic's Claude now supports up to 200,000 tokens with plans for further expansion [1], while Google's Gemini has achieved industry-leading context windows exceeding one million tokens [2].

Perhaps most significantly, the emergence of agentic AI systems has created new demands for dynamic context management. Companies like Manus are pioneering techniques for real-time context injection and adaptation, enabling autonomous systems to maintain coherent understanding across extended interactions and complex multi-step tasks [6].

## Introduction

The ability of large language models to process and understand context has become a critical differentiator in the AI industry. As organizations deploy these systems for increasingly sophisticated applications—from analyzing entire codebases to processing lengthy legal documents—the techniques used to manage and optimize context have grown in importance and complexity [3, 5].

This research investigates the current state of context engineering across four major players in the AI space: Anthropic, OpenAI, Google, and Manus. Each organization has developed distinctive approaches that reflect their broader technical philosophies and target use cases. Understanding these approaches provides valuable insight into both the current capabilities and future direction of AI systems.

## Key Findings

### The Expansion of Context Windows

The past year has witnessed remarkable expansion in the context processing capabilities of large language models. Anthropic's Claude models now support context windows of up to 200,000 tokens, representing a twenty-five fold increase from the 8,000 token limits common just two years ago [1]. This extended context capability enables the model to process entire codebases, lengthy documents, and complex multi-turn conversations while maintaining coherent understanding throughout [1].

Google has pushed even further with its Gemini models, achieving context windows exceeding one million tokens [2]. This capability required fundamental innovations in attention mechanisms to maintain performance at extreme context lengths. The research team developed novel approaches that enable efficient retrieval and reasoning within these massive context windows without proportional increases in computational cost [2].

OpenAI has taken a more measured approach, with GPT-4 supporting 128,000 tokens while focusing on optimizing the quality of context utilization rather than raw capacity [3]. Their documentation emphasizes that effective context engineering often matters more than context size, with structured approaches to context organization yielding performance improvements of up to 40 percent [3].

### Emerging Best Practices

Across all organizations studied, several common patterns have emerged in context engineering best practices [1, 3, 5]. Strategic context organization—structuring information hierarchically for optimal model comprehension—appears consistently in technical documentation and research papers. Anthropic's Constitutional AI principles have influenced their approach to context handling, ensuring safe and helpful responses even with complex or potentially adversarial context patterns [4].

Semantic chunking has become standard practice for processing long documents, with sophisticated algorithms determining optimal boundaries for splitting content while preserving meaning [5]. Dynamic context injection, particularly important for agentic systems, enables real-time updates to the context provided to models as situations evolve during extended interactions [6].

### Company-Specific Approaches

Each organization has developed approaches that reflect their unique technical philosophy. Anthropic emphasizes safety and reliability, with their Constitutional AI framework guiding context handling decisions [4]. Their systems demonstrate superior in-context learning capabilities, with research showing minimal performance degradation even at extended context lengths [1].

OpenAI has focused heavily on documentation and developer education, providing extensive guidance on prompt engineering and context optimization [3]. Their approach emphasizes instruction clarity and structured prompt formats, with research showing that properly formatted context can improve model performance by up to 40 percent on complex tasks [3].

Google leverages its expertise in information retrieval, integrating search capabilities with context management systems [2]. Their multimodal approach extends context engineering to encompass text, images, and video, enabling more comprehensive understanding of complex information environments [2].

Manus, while smaller than the other organizations studied, has made significant contributions to context engineering for autonomous agents [6]. Their techniques for dynamic context injection and real-time context adaptation address the unique challenges of agentic systems that must maintain coherent understanding across extended, multi-step interactions [6].

## Conclusion

Context engineering represents the next frontier in AI development, with implications extending far beyond simple increases in context window size [5]. The techniques developed by leading AI laboratories are enabling new categories of applications while simultaneously raising important questions about optimal approaches to information management in AI systems [1, 2, 3].

The convergence around certain best practices—strategic organization, semantic chunking, and dynamic injection—suggests an emerging consensus on foundational techniques [1, 3, 5]. However, significant differentiation remains in how organizations apply these techniques within their broader technical frameworks. For practitioners and researchers, understanding these varied approaches provides valuable guidance for implementing context engineering in specific applications.

As context windows continue to expand and techniques mature, the distinction between context engineering and other aspects of AI system design may become increasingly important. Organizations that develop sophisticated context management capabilities will likely gain significant advantages in deploying effective AI systems for complex, real-world applications [5].

## References

[1] Anthropic. "Claude's Extended Context Capabilities." *Anthropic Technical Documentation*, December 2024. https://anthropic.com/claude-context

[2] Google Research. "Context Windows and Long-Form Processing in Gemini." *Google AI Blog*, September 2024. https://research.google/context-windows

[3] OpenAI. "Building Better Prompts with Context." *OpenAI Research*, October 2024. https://openai.com/research/context-prompts

[4] Anthropic. "Constitutional AI and Context Safety." *Anthropic Research*, August 2024. https://anthropic.com/constitutional-ai

[5] Anthropic. "Context Engineering: The New Frontier." *Anthropic Blog*, November 2024. https://anthropic.com/blog/context-engineering

[6] Manus AI. "Dynamic Context Injection for Autonomous Agents." *Manus Technical Report*, October 2024. https://manus.ai/research/context-injection

---
*Report generated by Deep Research Agent*
*Date: ${new Date().toISOString().split('T')[0]}*
`;
    logger.logFinalReport(finalReport);

    // Log the final agent output (complete pipeline result)
    const finalAgentOutput = `I've completed comprehensive research on context engineering techniques from leading AI companies.

${finalReport}

This research was compiled from 25 authoritative sources published between June 2024 and December 2025. The investigation reveals that context engineering is rapidly establishing itself as a critical discipline in AI development, with significant innovations across all major players in the space.

The most striking finding is the dramatic expansion of context window capabilities. Anthropic's Claude now supports up to 200,000 tokens, while Google's Gemini has achieved industry-leading windows exceeding one million tokens. However, the research also makes clear that raw context size is only part of the equation—the techniques used to organize, manage, and optimize that context are equally important.

Each company has developed distinctive approaches that reflect their technical philosophies. Anthropic emphasizes safety through Constitutional AI principles, OpenAI focuses on developer education and structured prompting, Google leverages its search expertise for retrieval-augmented approaches, and Manus pioneers dynamic context injection for autonomous agents.

For practitioners looking to stay current with this rapidly evolving field, I recommend following the technical blogs and research publications from Anthropic, OpenAI, and Google, as well as monitoring academic venues like NeurIPS and ICLR where foundational context engineering research is often presented.`;

    logger.logFinalAgentOutput(finalAgentOutput);

    // Log costs
    logger.logCosts({
      total_cost_usd: 0.0847,
      input_tokens: 45230,
      output_tokens: 12540
    });

    // Complete the session
    logger.complete(67500, 0.0847); // 67.5 seconds

    // Verify log was created with all sections
    const content = fs.readFileSync(logPath, "utf-8");

    expect(content).toContain("**Topic:** Do some research on the latest context engineering techniques");
    expect(content).toContain("**Status:** COMPLETED");
    expect(content).toContain("## Pipeline Stages");
    expect(content).toContain("| planner |");
    expect(content).toContain("| web-search |");
    expect(content).toContain("| analysis |");
    expect(content).toContain("| report-writer |");
    expect(content).toContain("## Tool Calls");
    expect(content).toContain("## Planner Output");
    expect(content).toContain("## Search Results Summary");
    expect(content).toContain("## Analysis Output");
    expect(content).toContain("## Final Report");
    expect(content).toContain("## Costs & Usage");
    expect(content).toContain("$0.084700");
    expect(content).toContain("**Duration:** 67.50s");

    // Verify tool outputs are logged (complete, no truncation)
    expect(content).toContain("**Output:**");
    expect(content).toContain("Context Engineering: The New Frontier");
    expect(content).toContain("paradigm shift in how we design AI systems");
    expect(content).toContain("Claude's Extended Context Capabilities");
    expect(content).toContain("200K token context windows");

    // Verify final agent output is logged
    expect(content).toContain("## Final Agent Output");
    expect(content).toContain("complete output from the research agent pipeline");
    expect(content).toContain("I've completed comprehensive research on context engineering");
    expect(content).toContain("The most striking finding is the dramatic expansion");
    expect(content).toContain("For practitioners looking to stay current");

    // Log is intentionally NOT cleaned up - it stays in logs folder
    console.log(`\n✅ Integration test log saved to: ${logPath}\n`);
  });
});
