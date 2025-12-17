# Deep Research Agent

An AI-powered web research tool that conducts comprehensive research on any topic and generates detailed reports. Built with Next.js, the Claude Agent SDK, and Exa's neural search API.

## Features

- **Neural Search**: Uses Exa's semantic search to find relevant sources across the web
- **Deep Content Analysis**: Retrieves and analyzes full content from discovered sources
- **Similar Source Discovery**: Expands research by finding related articles and documents
- **Real-time Progress Tracking**: Watch the research process unfold with live updates
- **Comprehensive Reports**: Generates structured reports with executive summaries, key findings, detailed analysis, and source citations
- **Streaming Output**: Report content streams in real-time as the agent researches

## How It Works

1. Enter a research topic
2. The agent performs multiple neural searches with varied queries
3. Full content is retrieved from the most relevant sources (5-10+ articles)
4. Similar sources are discovered to expand coverage
5. Findings are synthesized into a comprehensive, cited report

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS, shadcn/ui
- **AI**: [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk) with Claude Haiku 4.5
- **Search**: [Exa](https://exa.ai) neural search API
- **Streaming**: Server-Sent Events for real-time updates

## Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)
- An [Exa API key](https://exa.ai)

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/deep-research-agent.git
   cd deep-research-agent
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file with your API keys:
   ```env
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
│   ├── api/research/     # Research API endpoint (streaming)
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Main research interface
├── components/
│   ├── research/         # Research-specific components
│   │   ├── ResearchInput.tsx
│   │   ├── ProgressTracker.tsx
│   │   ├── SourceList.tsx
│   │   └── ReportDisplay.tsx
│   └── ui/               # shadcn/ui components
├── hooks/
│   └── useResearchAgent.ts  # Research state management
├── lib/
│   └── agent/
│       ├── config.ts     # Agent configuration
│       ├── prompts.ts    # System and user prompts
│       └── tools.ts      # Exa MCP tools
└── types/
    └── research.ts       # TypeScript interfaces
```

## Agent Tools

The research agent has access to three Exa-powered tools:

| Tool | Description |
|------|-------------|
| `search` | Neural or keyword search across the web with filters for domains, dates, etc. |
| `get_contents` | Retrieve full text content from specific URLs |
| `find_similar` | Find articles similar to a given URL |

## License

MIT
