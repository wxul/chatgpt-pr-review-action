import * as core from "@actions/core";
import * as github from "@actions/github";
import { Chat } from "./chat";
import {
  assert,
  getPatchLineLength,
  include,
  uniqPromiseWithParams,
} from "./utils";

const MAX_TOKEN = 1800;

async function run() {
  const begin = Date.now();

  const GITHUB_TOKEN = process.env["GITHUB_TOKEN"];
  const OPENAI_API_KEY = process.env["OPENAI_API_KEY"];
  assert(GITHUB_TOKEN, "Environment GITHUB_TOKEN is required");
  assert(OPENAI_API_KEY, "Environment OPENAI_API_KEY is required");

  const language = core.getInput("language", { trimWhitespace: true });
  const model = core.getInput("model", { trimWhitespace: true });
  const globs = core.getMultilineInput("include");
  const techStack = core.getInput("tech_stack");

  core.info(
    `Inputs: \n${JSON.stringify(
      { language, model, include: globs, techStack },
      null,
      2
    )}`
  );

  const chat = new Chat(OPENAI_API_KEY, {
    language,
    model,
    techStack: techStack ? techStack.split(",") : [],
  });
  const context = github.context;
  const octokit = github.getOctokit(GITHUB_TOKEN);

  if (!OPENAI_API_KEY || !GITHUB_TOKEN) return;

  const pull_request = context.payload.pull_request;
  if (
    !pull_request ||
    pull_request.state === "closed" ||
    pull_request.draft ||
    pull_request.locked
  ) {
    core.info("No a valid pr");
    return;
  }
  core.info(`[Time:Start]: ${Date.now() - begin}`);
  const repo = {
    owner: pull_request.base.user.login,
    repo: pull_request.base.repo.name,
  };

  const { data: comments } = await octokit.rest.pulls.listReviewComments({
    ...repo,
    pull_number: pull_request.number,
  });
  core.info(`All Comments: \n${JSON.stringify(comments, null, 2)}`);

  const cachedCompare = uniqPromiseWithParams(
    async (params: { owner: string; repo: string; basehead: string }) => {
      return await octokit.rest.repos.compareCommitsWithBasehead({
        ...params,
      });
    }
  );

  const { data: compared } = await cachedCompare({
    ...repo,
    basehead: `${pull_request.base.sha}...${pull_request.head.sha}`,
  });

  const nothingChangedSincePreviousComment = async (
    path: string,
    patch: string
  ): Promise<boolean> => {
    const targetComment = comments.find((comment) => {
      return comment.path === path;
    });
    if (!targetComment) return false;
    if (targetComment && targetComment.diff_hunk === patch) return true;
    const { data: compareComment } = await cachedCompare({
      ...repo,
      basehead: `${targetComment.commit_id}...${pull_request.head.sha}`,
    });
    core.info(`Compare Files: \n${JSON.stringify(compareComment.files, null, 2)}`);
    return !Boolean(
      compareComment.files?.find((file) => file.filename === path)
    );
  };

  if (!compared.files || compared.files.length === 0) return;
  core.info(`All Files: \n${JSON.stringify(compared.files, null, 2)}`);
  core.info(`Commits: \n${JSON.stringify(compared.commits, null, 2)}`);
  const files: typeof compared.files = [];
  for (const file of compared.files) {
    let needReview =
      file.patch &&
      file.patch.length <= MAX_TOKEN &&
      ["modified", "added"].includes(file.status) &&
      include(file.filename, globs);
    if (!needReview) continue;
    const noChange = await nothingChangedSincePreviousComment(
      file.filename,
      file.patch
    );
    if (!noChange) {
      files.push(file);
    }
  }
  core.info(`Review Files: \n${JSON.stringify(files, null, 2)}`);
  for (const file of files) {
    const response = await chat.review(file.patch);
    if (response) {
      try {
        await octokit.rest.pulls.createReviewComment({
          ...repo,
          pull_number: pull_request.number,
          commit_id: compared.commits[compared.commits.length - 1].sha,
          path: file.filename,
          body: response,
          position: getPatchLineLength(file.patch) - 1,
        });
        core.info(
          `Add Commit: \n${response}\nFor patch of file(${file.filename}):\n${file.patch}`
        );
      } catch (error) {
        core.warning(`Request Error: ${error.message}`);
      }
    }
  }

  core.info(`[Time:End]: ${Date.now() - begin}`);
}

run().catch((error) => {
  core.setFailed(error.message);
});
