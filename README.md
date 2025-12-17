# Deep Research Agent

An AI-powered web research application that conducts comprehensive research on any topic using Claude and Exa search.

## Features

- **Neural Search**: Semantic web search powered by Exa for intelligent query understanding
- **Deep Content Analysis**: Fetches and analyzes full content from discovered sources
- **Source Expansion**: Finds similar content to expand research coverage
- **Real-time Progress**: Visual tracking of research steps as they happen
- **Structured Reports**: Generates comprehensive reports with executive summary, findings, and citations

## How It Works

1. Enter a research topic
2. The agent performs multiple search passes with query variations
3. Retrieves full content from the most relevant sources (5-10 minimum)
4. Discovers related sources using similarity search
5. Synthesizes findings into a structured report with citations

## Tech Stack

- **Framework**: Next.js 16 with React 19
- **AI Agent**: Claude via [@anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)
- **Web Search**: [Exa](https://exa.ai) for neural/keyword search and content retrieval
- **Styling**: Tailwind CSS with Radix UI components

## Prerequisites

- Node.js 18+
- [Anthropic API Key](https://console.anthropic.com/)
- [Exa API Key](https://exa.ai)

## Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd deep-research-agent
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file with your API keys:

```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
EXA_API_KEY=your_exa_api_key
```

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
src/
├── app/
│   ├── api/research/     # Research API endpoint (SSE streaming)
│   ├── layout.tsx
│   └── page.tsx          # Main UI
├── components/
│   ├── research/         # Research-specific components
│   │   ├── ProgressTracker.tsx
│   │   ├── ReportDisplay.tsx
│   │   ├── ResearchInput.tsx
│   │   └── SourceList.tsx
│   └── ui/               # Reusable UI components
├── hooks/
│   └── useResearchAgent.ts
├── lib/
│   └── agent/
│       ├── config.ts     # Agent configuration
│       ├── prompts.ts    # System prompts
│       └── tools.ts      # Exa MCP tools
└── types/
    └── research.ts       # TypeScript types
```

## Available Tools

The research agent has access to three Exa-powered tools:

| Tool | Description |
|------|-------------|
| `search` | Neural or keyword search with date/domain filters |
| `get_contents` | Fetch full content from specific URLs |
| `find_similar` | Discover content similar to a given URL |

## License

MIT
