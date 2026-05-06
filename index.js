#!/usr/bin/env node
import "dotenv/config";
import { program } from "commander";
import cron from "node-cron";
import chalk from "chalk";
import { runConnectionTask } from "./task-connect.js";
import { runMessagesTask } from "./task-messages.js";
import { runFeedTask } from "./task-feed.js";
import { logger } from "./src/utils/logger.js";

const banner = `
${chalk.cyan("╔══════════════════════════════════════════╗")}
${chalk.cyan("║")}   ${chalk.bold.white("CUE AI LinkedIn Automation Bot")}          ${chalk.cyan("║")}
${chalk.cyan("║")}   ${chalk.gray("Powered by Playwright + Claude AI")}        ${chalk.cyan("║")}
${chalk.cyan("╚══════════════════════════════════════════╝")}
`;

async function runTask(taskName) {
  console.log(banner);
  logger.info(`Starting task: ${taskName}`);

  try {
    switch (taskName) {
      case "connect":
        await runConnectionTask();
        break;
      case "messages":
        await runMessagesTask();
        break;
      case "feed":
        await runFeedTask();
        break;
      case "all":
        logger.info("Running all tasks...");
        await runConnectionTask();
        await runMessagesTask();
        await runFeedTask();
        break;
      default:
        logger.error(`Unknown task: ${taskName}`);
        process.exit(1);
    }
    logger.info(`Task "${taskName}" completed successfully.`);
  } catch (err) {
    logger.error(`Task "${taskName}" failed: ${err.message}`);
    logger.error(err.stack);
    process.exit(1);
  }
}

program
  .name("linkedin-bot")
  .description("LinkedIn automation for CUE AI founder")
  .version("1.0.0");

program
  .command("connect")
  .description("Send connection requests to target profiles (max 100/week)")
  .action(() => runTask("connect"));

program
  .command("messages")
  .description("Check and reply to unread LinkedIn messages")
  .action(() => runTask("messages"));

program
  .command("feed")
  .description("Scroll feed and comment on relevant posts")
  .action(() => runTask("feed"));

program
  .command("all")
  .description("Run all tasks: connect + messages + feed")
  .action(() => runTask("all"));

program
  .command("schedule")
  .description("Run on a weekly cron schedule (default: every Monday 9am)")
  .option(
    "-c, --cron <expression>",
    "Cron expression",
    process.env.CRON_SCHEDULE || "0 9 * * 1"
  )
  .action(({ cron: cronExpr }) => {
    console.log(banner);
    logger.info(`Scheduler started. Cron: "${cronExpr}"`);
    logger.info("Press Ctrl+C to stop.");

    // Run immediately on start, then on schedule
    runTask("all").catch((err) => logger.error(err.message));

    cron.schedule(cronExpr, () => {
      logger.info("Scheduled run triggered");
      runTask("all").catch((err) => logger.error(err.message));
    });
  });

// Parse CLI args
const args = process.argv.slice(2);

// Support --task= legacy flag
const taskFlag = args.find((a) => a.startsWith("--task="));
if (taskFlag) {
  const taskName = taskFlag.split("=")[1];
  runTask(taskName);
} else {
  program.parse(process.argv);

  // Show help if no command given
  if (args.length === 0) {
    console.log(banner);
    program.help();
  }
}
