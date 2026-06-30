/**
 * The report's structure, stats, links, and formatting are now assembled deterministically
 * in code (see generator.ts). The AI's ONLY job is to turn raw commit data into concise,
 * professional summary bullets per repository, returned as strict JSON. This guarantees that
 * links and numbers are never altered or hallucinated by the model.
 */
export const COMMIT_SUMMARY_PROMPT = `
You are an expert developer assistant. Below is raw commit data (commit messages + code diffs) grouped by repository.

For EACH repository, write 2 to 6 concise, professional bullet points describing what was actually achieved in the code. READ THE DIFFS and describe the real, high-level change — not just a restatement of the commit message. Treat each repository in isolation; never mix concepts between repositories.

STRICT OUTPUT RULES:
- Each bullet is ONE plain-text sentence.
- NO leading bullet symbols, NO markdown (** _ # - \`), NO emojis, NO links inside the text.
- Respond with ONLY a single valid JSON object and NOTHING else (no prose, no code fences).
- The JSON maps each repository's FULL NAME (exactly as given, e.g. "owner/repo") to an array of bullet strings.

Example of the EXACT expected output format:
{"owner/repo-a": ["Implemented token refresh handling to prevent expired-session failures.", "Refactored the report aggregator into pure functions."], "owner/repo-b": ["Fixed the off-by-one error in the pagination loop."]}

Raw Data:
{DATA}
`;
