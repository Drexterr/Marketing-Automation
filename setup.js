#!/usr/bin/env node
import readline from "readline";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question, defaultValue = "") {
  return new Promise((resolve) => {
    const hint = defaultValue ? ` (default: ${defaultValue})` : "";
    rl.question(`${question}${hint}: `, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function askSecret(question) {
  return new Promise((resolve) => {
    process.stdout.write(`${question}: `);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let input = "";
    stdin.on("data", function handler(char) {
      if (char === "\r" || char === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", handler);
        process.stdout.write("\n");
        resolve(input);
      } else if (char === "") {
        process.exit();
      } else if (char === "") {
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else {
        input += char;
        process.stdout.write("*");
      }
    });
  });
}

async function main() {
  console.log("\n=== CUE AI LinkedIn Automation — Setup ===\n");

  // LinkedIn credentials
  console.log("-- LinkedIn Credentials --");
  const linkedinEmail = await ask("LinkedIn email");
  const linkedinPassword = await askSecret("LinkedIn password");

  // Anthropic
  console.log("\n-- Anthropic API --");
  const anthropicKey = await askSecret("Anthropic API key (sk-ant-...)");

  // Founder / product identity
  console.log("\n-- Your Identity (used in AI prompts) --");
  const founderName = await ask("Your name", "Founder");
  const founderRole = await ask("Your role", "Founder");
  const productName = await ask("Product name", "CUE AI");
  const productDescription = await ask(
    "Product description",
    "A stealthy, always-on-top Electron overlay that listens to your system audio, transcribes speech in real time, and injects interview prompts directly into AI chat interfaces (ChatGPT, Claude, Gemini, DeepSeek)."
  );

  // Automation config
  console.log("\n-- Automation Config --");
  const weeklyLimit = await ask("Weekly connection limit", "100");
  const headless = await ask("Run headless? (true/false)", "false");
  const slowMo = await ask("Slow motion delay in ms", "50");
  const cronSchedule = await ask("Cron schedule", "0 9 * * 1");

  rl.close();

  // Write .env
  const envContent = `# LinkedIn Credentials
LINKEDIN_EMAIL=${linkedinEmail}
LINKEDIN_PASSWORD=${linkedinPassword}

# Anthropic API Key
ANTHROPIC_API_KEY=${anthropicKey}

# Automation Config
WEEKLY_CONNECTION_LIMIT=${weeklyLimit}
HEADLESS=${headless}
SLOW_MO=${slowMo}

# CUE AI Product Context (used for AI prompts)
PRODUCT_NAME=${productName}
PRODUCT_DESCRIPTION=${productDescription}
FOUNDER_NAME=${founderName}
FOUNDER_ROLE=${founderRole}

# Target Audience Keywords (comma-separated)
TARGET_KEYWORDS=software engineer,developer,tech lead,engineering manager,product manager,startup founder,recruiter,HR,talent acquisition,job seeker

# Cron Schedule (default: every Monday at 9am)
CRON_SCHEDULE=${cronSchedule}
`;

  fs.writeFileSync(path.join(process.cwd(), ".env"), envContent);
  console.log("\n✓ .env written");

  // Install dependencies
  console.log("\nInstalling npm dependencies...");
  execSync("npm install", { stdio: "inherit" });
  console.log("✓ Dependencies installed");

  // Install Playwright browser
  console.log("\nInstalling Playwright Chromium browser...");
  execSync("npx playwright install chromium", { stdio: "inherit" });
  console.log("✓ Chromium installed");

  console.log(`
=== Setup complete ===

Next steps:
  1. Run: npm run connect
     → Set HEADLESS=false in .env for the first run so you can solve any CAPTCHA manually.
  2. Check logs/automation.log to confirm activity.
  3. Review data/connections-sent.json after the first run.
`);
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
