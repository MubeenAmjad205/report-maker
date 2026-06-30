# 🚀 Automated Daily Report Maker

A fully automated, zero-deployment pipeline that runs daily on GitHub Actions to extract your GitHub commits, process them using AI, and generate a professional progress report delivered to Telegram, MS Teams, and/or GitHub Issues.

## 🎯 Features
- **Zero-Deployment Architecture:** Operates entirely on GitHub Actions via a Cron schedule. No external servers or PM2 setups required.
- **Adaptive AI Engine:** Seamlessly toggle between Google Gemini, OpenAI, or OpenRouter for report generation.
- **Cross-Repo Tracking:** Extracts commits across your public and private repositories using a single Personal Access Token (via the Events API, Search API, and a direct branch scan of your most recently pushed repos).
- **Deterministic, AI-Safe Reports:** The report's structure, stats, links, owner grouping, and charts are assembled in **code** — the AI only writes the prose summary bullets. This guarantees links and numbers are never altered or hallucinated. If the AI provider is unavailable, the report still generates (falling back to commit messages for the bullets).
- **Owner-Grouped Reports:** Activity is grouped first by repository **owner** (e.g. `MubeenAmjad205`, `nabeeltahir`, or any organization), each with a summary header, then by repository under that owner.
- **At-a-Glance Dashboard:** A one-line ⚡ headline ("5 commits • 2 projects • 1 PR merged • all CI green"), grand totals (repos, commits, PRs, CI runs, net LOC, churn), and styled dividers — all rendered with Teams-safe Unicode.
- **Commit-Type Badges:** Conventional-commit prefixes are tallied into badges (`✨ 2 feat • 🐛 1 fix • ♻️ 1 refactor`) per report and per repo.
- **Code Balance Bar:** A proportional 🟩/🟥 bar shows additions vs deletions with a percentage, per report and per repo.
- **CI Health Summary:** Each repo shows a colored-dot strip and pass rate (`🟢🔴🟢 → 2/3 passed (67%)`) alongside the run list.
- **Commit Bar Charts:** Each owner group includes a Unicode bar chart of commits per project (Teams/Telegram safe).
- **Pull Request Tracking:** For every repository, the report lists pull requests **opened**, **merged**, and **closed (without merge)** today — with their titles, authors, and direct links. Repositories with PR activity but no commits are still included.
- **CI / Actions Runs:** For every repository, the report lists GitHub Actions workflow runs that executed today, marked ✅ success / ❌ failure / ⚪ other, with direct links to each run.
- **Rich Linking:** Every repository, pull request, commit, and CI run is included as a raw, clickable URL (raw URLs render as links in MS Teams, Telegram, and GitHub — markdown links do not).
- **File-Type Breakdown:** Each repository shows which file types changed (e.g. `12 .ts, 3 .css`).
- **Pakistan-Time Aware:** The "today" window is anchored to midnight **PKT (UTC+5)**, so commits made between PKT midnight and early morning are correctly included.
- **MS Teams-Safe Formatting:** Reports are generated as clean plain text with standard Unicode emojis (`📅 👤 🏢 🚀 🔀 ✅ •`) and **no** markdown or HTML, so they render identically in MS Teams, Telegram, and GitHub Issues without showing literal `**`, `-`, or backtick characters.
- **Multi-Channel Delivery:** Sends the report to Telegram, MS Teams, and GitHub Issues. When Telegram is configured, a secondary "Technical Telemetry" message is sent with execution-flow steps, commit/PR/file stats, and AI token usage.

---

## 🛠️ Project Structure

Built with a modular, domain-driven Functional Programming approach:

```text
.github/workflows/
  daily-report.yml        # Core execution schedule (Runs at 7:45 PM PKT / GMT+5, Mon–Sat)
src/
  core/config/            # Environment variable validation
  shared/
    constants/            # AI prompts and feature toggles
    types/                # Global TypeScript definitions
    utils/                # Pure utility functions
  features/
    github/               # Cross-repo commit, pull-request, and CI-run extraction
    ai/                   # Dynamic LLM Provider Factory + deterministic report assembly
    notifier/             # Telegram, MS Teams, and GitHub Issues delivery services
  index.ts                # App entrypoint
```

---

## ⚙️ Setup & Deployment Instructions

Since this is a GitHub Actions exclusive project, "deploying" it simply means pushing the code to GitHub and configuring your repository secrets.

### 1. Push to GitHub
1. Create a new repository on GitHub (Private recommended).
2. Push this local codebase to your new repository.

### 2. Configure GitHub Secrets
Go to your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions**, and add the following secrets:

| Secret Name | Description | Example |
|---|---|---|
| \`GH_PAT\` | GitHub Personal Access Token (classic) with \`repo\` scope to read commits. | \`ghp_abc123...\` |
| \`GITHUB_USERNAME\` | Your exact GitHub username (used for filtering commits). If omitted, the workflow falls back to the value hardcoded in \`daily-report.yml\`. | \`yourusername\` |
| \`AI_PROVIDER\` | The AI model you wish to use. Options: \`GEMINI\`, \`OPENAI\`, \`OPENROUTER\`. | \`OPENROUTER\` |
| \`AI_MODEL\` | The specific model string to use with your provider. | \`google/gemini-flash-1.5\` |
| \`AI_API_KEY\` | The API key corresponding to your chosen AI provider. | \`AIzaSy...\` |
| \`TELEGRAM_BOT_TOKEN\` | (Optional) Bot token obtained from \`@BotFather\` on Telegram. | \`123456:ABC-DEF...\` |
| \`TELEGRAM_CHAT_ID\` | (Optional) The ID of the Telegram user or group to send the report to. | \`123456789\` |
| \`MSTEAMS_WEBHOOK_URL\` | (Optional) The incoming webhook URL for your MS Teams channel. | \`https://...webhook.office.com...\` |

> **Note:** You must configure *at least one* delivery method (either Telegram OR MS Teams, or both). GitHub Issue notifications are created automatically when the action runs (using \`GH_PAT\` and the runner's \`GITHUB_REPOSITORY\`).

### 3. Schedule Modification (Optional)
By default, the report is generated every day **except Sunday** at **7:45 PM PKT (GMT+5)**, which is **14:45 UTC**.
If you need to change this schedule, open \`.github/workflows/daily-report.yml\` and modify the cron expression (cron runs in UTC):
\`\`\`yaml
  schedule:
    - cron: '45 14 * * 1-6' # 14:45 UTC = 7:45 PM PKT, Monday–Saturday
\`\`\`

---

## 🧪 Local Testing

If you wish to test the pipeline locally before waiting for the GitHub Action to trigger:

1. Create a \`.env\` file in the root directory and add the environment variables listed above.
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
3. Run the script:
   \`\`\`bash
   npm start
   \`\`\`

> **Tip:** Set \`DRY_RUN=true\` in your \`.env\` to print the generated report to the console instead of sending it to Telegram, MS Teams, or GitHub Issues.
