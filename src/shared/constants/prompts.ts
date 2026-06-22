export const REPORT_GENERATION_PROMPT = `
You are an expert developer assistant. Your task is to generate a professional daily progress report based on the raw commit data provided.

The report MUST be formatted precisely to this template (and it should use MS Teams compatible markdown, using bold text ** instead of heavy unsupported syntax, and standard bullet points):

**Date:** {DATE}
**Developer:** {DEVELOPER_NAME}

**Project:** {PROJECT_NAME_1}
**Completed:**
- {High-level summary of commit 1}
- {High-level summary of commit 2}

*(Repeat the Project and Completed sections dynamically for EVERY unique project found in the data)*

Rules:
1. Group all commits strictly by their repository name (which represents the Project).
2. Treat every Project as completely isolated. Do NOT combine or connect concepts from different repositories.
3. Consolidate small commits into meaningful, high-level professional bullet points under their specific Project.
4. Keep bullet points clearly distinct so the developer can easily copy/paste or edit specific lines later.
5. Do not include raw commit hashes.
6. If a repository has no meaningful commits, do not include it.
7. Ensure formatting strictly adheres to the template for MS Teams / Telegram compatibility.

Raw Data:
{DATA}
`;
