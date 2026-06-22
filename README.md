# 🚀 Automated Daily Report Maker

A fully automated, zero-deployment pipeline that runs daily on GitHub Actions to extract your GitHub commits, process them using AI, and generate a professional progress report sent directly to your Telegram or MS Teams environment.

## 🎯 Features
- **Zero-Deployment Architecture:** Operates entirely on GitHub Actions via a Cron schedule. No external servers or PM2 setups required.
- **Adaptive AI Engine:** Seamlessly toggle between Google Gemini, OpenAI, or OpenRouter for report generation.
- **Cross-Repo Tracking:** Extracts commits across all your public and private repositories using a single Personal Access Token.
- **Platform-Agnostic Markdown:** Reports are meticulously formatted using standard markdown syntax to ensure perfect rendering on MS Teams, Telegram, and Discord.

---

## 🛠️ Project Structure

Built with a modular, domain-driven Functional Programming approach:

```text
.github/workflows/
  daily-report.yml        # Core execution schedule (Runs at 6:45 PM GMT+5)
src/
  core/config/            # Environment variable validation
  shared/
    constants/            # AI prompts and feature toggles
    types/                # Global TypeScript definitions
    utils/                # Pure utility functions
  features/
    github/               # Cross-repo commit extraction
    ai/                   # Dynamic LLM Provider Factory
    notifier/             # Telegram/MS Teams delivery service
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
| \`GITHUB_USERNAME\` | Your exact GitHub username (used for filtering commits). | \`yourusername\` |
| \`AI_PROVIDER\` | The AI model you wish to use. Options: \`GEMINI\`, \`OPENAI\`, \`OPENROUTER\`. | \`GEMINI\` |
| \`AI_API_KEY\` | The API key corresponding to your chosen AI provider. | \`AIzaSy...\` |
| \`TELEGRAM_BOT_TOKEN\` | (Optional) Bot token obtained from \`@BotFather\` on Telegram. | \`123456:ABC-DEF...\` |
| \`TELEGRAM_CHAT_ID\` | (Optional) The ID of the Telegram user or group to send the report to. | \`123456789\` |
| \`MSTEAMS_WEBHOOK_URL\` | (Optional) The incoming webhook URL for your MS Teams channel. | \`https://...webhook.office.com...\` |

> **Note:** You must configure *at least one* delivery method (either Telegram OR MS Teams, or both).

### 3. Schedule Modification (Optional)
By default, the report is generated every day **except Sunday** at **6:45 PM GMT+5**.
If you need to change this schedule, open \`.github/workflows/daily-report.yml\` and modify the cron expression:
\`\`\`yaml
  schedule:
    - cron: '45 13 * * 1-6' # Modifying this adjusts the trigger time
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
