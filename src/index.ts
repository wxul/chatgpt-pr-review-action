import * as core from "@actions/core";
import * as github from "@actions/github";
import { assert } from "console";
import { Chat } from "./chat";

async function run() {
  const begin = Date.now();
  const GITHUB_TOKEN = process.env["GITHUB_TOKEN"];
  const OPENAI_API_KEY = process.env["OPENAI_API_KEY"];
  assert(GITHUB_TOKEN, "Environment GITHUB_TOKEN is required");
  assert(OPENAI_API_KEY, "Environment OPENAI_API_KEY is required");

  const language = core.getInput("language", { trimWhitespace: true });
  const model = core.getInput("model", { trimWhitespace: true });
  const include = core.getInput("include");
  const techStack = core.getInput("tech_stack");

  const chat = new Chat(OPENAI_API_KEY);
  const context = github.context;
  const octokit = github.getOctokit(GITHUB_TOKEN);

  core.info(
    `params: ${JSON.stringify({ language, model, include, techStack })}`
  );
  core.info(`context: ${JSON.stringify(context)}`);
}

run().catch((error) => {
  core.setFailed(error.message);
});
