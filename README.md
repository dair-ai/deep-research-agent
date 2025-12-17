# Deep Research Agent

AI-powered comprehensive web research using Claude and Exa. This application uses a multi-agent pipeline to conduct thorough research on any topic and generate professional reports.

## Features

- **Multi-Agent Pipeline**: Orchestrates 3 specialized agents working in sequence
- **Deep Web Search**: Uses Exa API for semantic search and content retrieval
- **Professional Reports**: Generates well-structured research reports with inline citations
- **Real-time Progress**: Visual pipeline progress tracking during research
- **Streaming Results**: Live updates as each stage completes

## Architecture

The research pipeline consists of 3 specialized agents:

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Planner    │ -> │  WebSearch   │ -> │ ReportWriter │
│              │    │              │    │              │
│ Creates      │    │ Gathers      │    │ Generates    │
│ search       │    │ sources      │    │ final        │
│ strategy     │    │ from web     │    │ report       │
└──────────────┘    └──────────────┘    └──────────────┘
```

1. **Planner Agent**: Analyzes the topic and creates optimized search queries with date ranges
2. **WebSearch Agent**: Executes searches using Exa API, gathers and reads source content
3. **ReportWriter Agent**: Produces a comprehensive markdown report with citations

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **AI**: Claude (via Claude Agent SDK), Anthropic API
- **Search**: Exa API (semantic web search)
- **Deployment**: Vercel with Vercel Sandbox for production

## Getting Started

### Prerequisites

- Node.js 18+
- Anthropic API key
- Exa API key ([get one here](https://exa.ai))

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

## Deploying to Vercel (Production)

The app uses **Vercel Sandbox** to run the Claude Agent SDK in production. This is necessary because Vercel serverless functions can't spawn subprocesses, but the SDK requires this capability for MCP servers.

### Step 1: Create Vercel API Token

1. Go to [Vercel Account Tokens](https://vercel.com/account/tokens)
2. Click "Create Token"
3. Name it (e.g., "deep-research-sandbox")
4. Set scope to your account or team
5. Copy the token (you won't see it again!)

### Step 2: Get Project and Team IDs

After deploying to Vercel:

1. **Project ID**: Go to your project → Settings → General → scroll to "Project ID"
2. **Team ID** (if using a team): Go to Team Settings → General → "Team ID"

### Step 3: Configure Environment Variables

In your Vercel project dashboard, go to Settings → Environment Variables and add:

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Yes |
| `EXA_API_KEY` | Your Exa API key | Yes |
| `VERCEL_TOKEN` | Vercel API token (from Step 1) | Yes (production) |
| `VERCEL_PROJECT_ID` | Your Vercel project ID | Yes (production) |
| `VERCEL_TEAM_ID` | Your Vercel team ID | If using a team |

### Step 4: Deploy

1. Push your code to GitHub
2. Import the repository in Vercel
3. Vercel will auto-detect Next.js settings
4. Deploy!

### How Vercel Sandbox Works

When running in production on Vercel:

1. A research request comes in to `/api/research`
2. The API detects it's running on Vercel (`VERCEL` env var)
3. Instead of running the SDK directly, it creates a **Vercel Sandbox**
4. The sandbox is an isolated container with Node.js 22
5. Inside the sandbox:
   - Dependencies are installed (`@anthropic-ai/claude-agent-sdk`, `exa-js`, `zod`)
   - The research script runs with full subprocess capabilities
   - Exa API searches are executed
   - Results stream back to the main API
6. The sandbox is cleaned up after completion

This allows the Claude Agent SDK to work properly in a serverless environment.

## Environment Variables

### Local Development

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `EXA_API_KEY` | Your Exa API key |

### Vercel Production

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `EXA_API_KEY` | Your Exa API key |
| `VERCEL_TOKEN` | Vercel API token for sandbox authentication |
| `VERCEL_PROJECT_ID` | Your Vercel project ID |
| `VERCEL_TEAM_ID` | Your Vercel team ID (optional, for team accounts) |

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
│   │   ├── config.ts     # Orchestrator and agent config
│   │   ├── subagents.ts  # Subagent definitions
│   │   ├── tools.ts      # Exa MCP tools (local)
│   │   └── prompts.ts    # Research prompts
│   └── sandbox/          # Vercel Sandbox runner
│       └── runner.ts     # Sandbox script generation
└── types/
    └── research.ts       # TypeScript types
```

## Troubleshooting

### "Stream closed" errors locally
- Update the Claude Agent SDK: `npm install @anthropic-ai/claude-agent-sdk@latest`

### Sandbox not working in production
- Verify `VERCEL_TOKEN` is set correctly
- Check that `VERCEL_PROJECT_ID` matches your project
- If using a team, ensure `VERCEL_TEAM_ID` is set
- Check Vercel logs for sandbox creation errors

### Exa searches not returning results
- Verify `EXA_API_KEY` is valid
- Check date ranges aren't too restrictive
- Try broader search queries

## License

MIT
