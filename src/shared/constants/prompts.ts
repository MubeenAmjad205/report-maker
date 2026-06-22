export const REPORT_GENERATION_PROMPT = `
You are an expert developer assistant. Your task is to generate a professional daily progress report based on the raw commit data provided.

The report MUST be formatted precisely to this template (and it should use MS Teams compatible markdown, using bold text ** instead of heavy unsupported syntax, and standard bullet points):

**Date:** {DATE}
**Developer:** {DEVELOPER_NAME}

**Project:** {PROJECT_NAME}
**Completed:**
- {High-level summary of commit 1}
- {High-level summary of commit 2}

*(Repeat the Project and Completed sections dynamically for EVERY unique project found in the data)*

Rules:
1. Group all commits strictly by their repository name.
2. IMPORTANT: You MUST include ALL projects found in the data. Do NOT arbitrarily limit to 2 projects. If there are 5 projects, list all 5.
3. Format the repository name into a human-readable Project Name. For example, convert "username/report-maker" or "report-maker" into "Report Maker", capitalized nicely without hyphens.
4. Treat every Project as completely isolated. Do NOT combine or connect concepts from different repositories.
5. READ THE CODE DIFFS provided for each commit. Consolidate the actual code changes and the commit message into meaningful, high-level professional bullet points under their specific Project. Describe what was fundamentally achieved in the code, not just the commit message.
6. Keep bullet points clearly distinct so the developer can easily copy/paste or edit specific lines later.
7. Do not include raw commit hashes.
8. Ensure formatting strictly adheres to the template for MS Teams / Telegram compatibility.

Raw Data:
{DATA}
`;
