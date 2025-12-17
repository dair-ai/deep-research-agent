/**
 * Sandbox Module
 *
 * Provides isolated execution environment for running the Claude Agent SDK
 * in serverless environments like Vercel where subprocess spawning is restricted.
 */

export {
  runResearchInSandbox,
  isVercelEnvironment,
  type SandboxMessage,
  type RunResearchOptions,
} from "./runner";
