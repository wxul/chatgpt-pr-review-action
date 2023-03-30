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
  const include = core.getMultilineInput("include");
  const techStack = core.getInput("tech_stack");

  const chat = new Chat(OPENAI_API_KEY);
  const context = github.context;
  const octokit = github.getOctokit(GITHUB_TOKEN);

  core.info(
    `params: ${JSON.stringify({ language, model, include, techStack })}`
  );

  if (
    !context.payload.pull_request ||
    context.payload.pull_request.state === "closed" ||
    context.payload.pull_request.draft ||
    context.payload.pull_request.locked
  ) {
    core.info("No a valid pr");
    return;
  }
  const { data: pullRequest } = await octokit.rest.pulls.get({
    owner: context.payload.pull_request.base.user.login,
    repo: context.payload.pull_request.base.repo.name,
    pull_number: context.payload.pull_request.number,
    mediaType: {
      format: "patch",
    },
  });
  core.info(JSON.stringify(pullRequest.assignee));
  core.info(JSON.stringify(pullRequest.assignees));
  core.info(JSON.stringify(pullRequest.body));
  core.info(JSON.stringify(pullRequest.changed_files));
  core.info(JSON.stringify({ ...pullRequest }));

  if (!OPENAI_API_KEY || !GITHUB_TOKEN) return;
}

run().catch((error) => {
  core.setFailed(error.message);
});
