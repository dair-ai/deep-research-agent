/**
 * Generate the current date/time in ISO format
 */
export const getCurrentDateTime = () => new Date().toISOString();

/**
 * Research prompt template with current date/time for the planner agent
 */
export const RESEARCH_PROMPT_TEMPLATE = (topic: string) => {
  const currentDateTime = getCurrentDateTime();

  return `Conduct deep research on the following topic and provide a comprehensive report:

**Research Topic:** ${topic}

**Current Date/Time:** ${currentDateTime}

Please use this date/time information to:
1. Set appropriate date ranges for searching (the planner agent should use this)
2. Prioritize recent vs historical sources based on the topic
3. Filter out outdated information when researching current events

Pipeline Instructions:
1. First, call the planner-agent to create an optimized search strategy with date ranges
2. Then, pass the search plan to web-search-agent to gather sources
3. Next, pass sources to analysis-agent for insights extraction
4. Finally, pass analysis to report-writer-agent for the final report

Start the research pipeline now.`;
};
