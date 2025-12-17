## Session 4 - Iterating and Deploying the App

Fork our project: https://github.com/dair-ai/deep-research-agent.git

Goals:
- Covert agent to multi-agent system
- We can instruct it from scratch to build out the subagents we want or build it with the previous subagent we built in Claude Code.
- Parallelizing/decomposing for our deep research agent
- Advanced workflows
    - Git Worktrees - Work on multiple features in parallel - scaling efforts with git worktrees
- Deploying the app
    - Option 1 (recommended) - GitHub -> Connect in Vercel
    - Option 2 - Vercel-cli deployment

## Part 1 - Advanced workflows

- Advanced workflows
    - Parallelizing tasks / background tasks (on web/desktop/locally)
    - Run a background task (bash) to check server logs frequently
        - Need to enable logging in the app
        - run a deep research request then ask questions like :"what is the agent doing? " and "analyze the results", "any room for improvement?"; it's a bit of observability that's helpful for debugging issues early on

- Git Worktrees - Work on multiple features in parallel - scaling efforts with git worktrees
    - Git worktrees check out multiple branches of the same repository into seperate directories
    - work on multiple features at the same time
        - build API endpoints while you build the frontend
    - Steps in the terminal:
        - git worktree add ../deep-research-frontend -b frontend
            - cd ../deep-research-frontend
            - start claude; then work on the frontend
        - git worktree add ../deep-research-subagents -b subagents
            - cd ../deep-research-subagents
            - start claude; then work on the subagents
        - remove worktrees:
            - git worktree remove ../deep-research-frontend
            - git worktree remove ../deep-research-subagents


## Part 2 - Iterate on the app

- Keep improving the system prompt with human feedback
- Create a log folder
- Store logs in the log folder and iterate with Claude Code using your feedback to improve the app


## Part 3 - Deploying the app

- Option 1 (recommended) - GitHub -> Connect in Vercel
- Option 2 - Vercel-cli deployment


# Useful links

- For long running tasks: https://www.anthropic.com/news/enabling-claude-code-to-work-more-autonomously
- Write effective tools: https://www.anthropic.com/engineering/writing-tools-for-agents