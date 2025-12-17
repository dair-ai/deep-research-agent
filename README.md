# Deep Research Agent

AI-powered comprehensive web research using Claude and Exa. This application uses a multi-agent pipeline to conduct thorough research on any topic and generate professional reports.

## Features

- **Multi-Agent Pipeline**: Orchestrates 4 specialized agents working in sequence
- **Deep Web Search**: Uses Exa API for semantic search and content retrieval
- **Professional Reports**: Generates well-structured research reports with inline citations
- **Real-time Progress**: Visual pipeline progress tracking during research
- **Streaming Results**: Live updates as each stage completes

## Architecture

The research pipeline consists of 4 specialized agents:

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Planner    │ -> │  WebSearch   │ -> │   Analysis   │ -> │ ReportWriter │
│              │    │              │    │              │    │              │
│ Creates      │    │ Gathers      │    │ Extracts     │    │ Generates    │
│ search       │    │ sources      │    │ key          │    │ final        │
│ strategy     │    │ from web     │    │ findings     │    │ report       │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

1. **Planner Agent**: Analyzes the topic and creates optimized search queries with date ranges
2. **WebSearch Agent**: Executes searches using Exa API, gathers and reads source content
3. **Analysis Agent**: Processes sources, identifies themes, extracts key findings
4. **ReportWriter Agent**: Produces a comprehensive markdown report with citations

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **AI**: Claude (via Claude Agent SDK), Anthropic API
- **Search**: Exa API (semantic web search)
- **Deployment**: Vercel with Vercel Sandbox for production

## Getting Started

### Prerequisites

- Node.js 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed
- Anthropic API key
- Exa API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/dair-ai/deep-research-agent.git
cd deep-research-agent
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment file and add your keys:
```bash
cp .env.example .env.local
```

4. Edit `.env.local` with your API keys:
```env
ANTHROPIC_API_KEY=your-anthropic-api-key
EXA_API_KEY=your-exa-api-key
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

### Required for Local Development

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `EXA_API_KEY` | Your Exa API key ([get one here](https://exa.ai)) |

### Required for Vercel Production

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `EXA_API_KEY` | Your Exa API key |
| `VERCEL_API_TOKEN` | Vercel API token ([create here](https://vercel.com/account/tokens)) |
| `VERCEL_PROJECT_ID` | Your Vercel project ID (Settings → General) |
| `VERCEL_TEAM_ID` | Your Vercel team ID (Team Settings → General) |

## Deployment on Vercel

The app uses Vercel Sandbox to run the Claude Agent SDK in production (since serverless functions can't spawn subprocesses).

1. Push to GitHub
2. Import project in Vercel
3. Add all environment variables (see table above)
4. Deploy

The sandbox creates an isolated container for each research request, installs the necessary dependencies, and runs the research pipeline.

## Project Structure

```
src/
├── app/
│   ├── api/research/     # Research API endpoint
│   └── page.tsx          # Main page
├── components/
│   └── research/         # Research UI components
├── hooks/
│   └── useResearchAgent.ts  # Research state management
├── lib/
│   ├── agent/            # Agent configuration & prompts
│   └── sandbox/          # Vercel Sandbox runner
└── types/
    └── research.ts       # TypeScript types
```

## License

MIT
