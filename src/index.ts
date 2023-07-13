import * as core from "@actions/core";
import * as github from "@actions/github";
import { Chat } from "./chat";
import {
  assert,
  getPatchLineLength,
  include,
  uniqPromiseWithParams,
} from "./utils";

const DEFAULT_MAX_TOKEN = 4000;
const PAGE_SIZE = 100;

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
  const customSystem = core.getInput("custom_system");
  const overridePrompt = core.getInput("override_prompt");
  const maxToken = Number(core.getInput("max_token")) || DEFAULT_MAX_TOKEN;
  const filterLabel = core.getInput("filter_with_label");

  core.debug(
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
    system: customSystem,
    overridePrompt,
  });
  const context = github.context;
  const octokit = github.getOctokit(GITHUB_TOKEN);

  const pull_request = context.payload.pull_request;
  if (filterLabel) {
    // skip review if filter_with_label is not in pr labels
    if (
      !(pull_request.labels || []).find((label) => label.name === filterLabel)
    ) {
      core.info(`Label ${filterLabel} is not found, skip review.`);
      core.info(`[Time:End]: ${Date.now() - begin}`);
      return;
    }
  }
  if (
    !pull_request ||
    pull_request.state === "closed" ||
    pull_request.draft ||
    pull_request.locked
  ) {
    throw new Error("Not a valid pull request");
  }
  core.info(`[Time:Start]: ${Date.now() - begin}`);
  const repo = {
    owner: pull_request.base.user.login,
    repo: pull_request.base.repo.name,
  };

  const { data: comments } = await octokit.rest.pulls.listReviewComments({
    ...repo,
    pull_number: pull_request.number,
    per_page: PAGE_SIZE,
    page: 1,
  });
  // list all comments
  if (comments.length >= PAGE_SIZE) {
    let index = 2;
    while (true) {
      const { data: append } = await octokit.rest.pulls.listReviewComments({
        ...repo,
        pull_number: pull_request.number,
        per_page: PAGE_SIZE,
        page: index,
      });
      comments.push(...append);
      index++;
      if (append.length < PAGE_SIZE) break;
      if (index > 10) {
        throw new Error("Too many comments");
      }
    }
  }

  core.debug(`All Comments: \n${JSON.stringify(comments, null, 2)}`);

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
  const lastCommitId = compared.commits[compared.commits.length - 1].sha;

  const nothingChangedSincePreviousComment = async (
    path: string,
    patch: string
  ): Promise<boolean> => {
    const targetComments = comments.filter((comment) => {
      return comment.path === path;
    });
    if (!targetComments || targetComments.length === 0) return false;
    const exactMatch = targetComments.find(
      (comment) => comment.diff_hunk === patch
    );
    if (exactMatch) return true;
    const latestComment = targetComments.sort(
      (c1, c2) => +new Date(c2.created_at) - +new Date(c1.created_at)
    )[0];
    const { data: compareComment } = await cachedCompare({
      ...repo,
      basehead: `${latestComment.original_commit_id}...${lastCommitId}`,
    });
    core.debug(
      `Compare Files: \n${JSON.stringify(compareComment.files, null, 2)}`
    );
    return !Boolean(
      compareComment.files?.find((file) => file.filename === path)
    );
  };

  if (!compared.files || compared.files.length === 0) return;
  core.debug(`All Files: \n${JSON.stringify(compared.files, null, 2)}`);
  core.debug(`Commits: \n${JSON.stringify(compared.commits, null, 2)}`);
  const files: typeof compared.files = [];
  for (const file of compared.files) {
    let needReview =
      file.patch &&
      file.patch.length <= maxToken &&
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
  core.debug(`Review Files: \n${JSON.stringify(files, null, 2)}`);
  for (const file of files) {
    const response = await chat.review(file.patch);
    if (response) {
      if (response.length < 10) {
        core.info(
          `Too simple to require a review(${file.filename}): \n${response}\nwith patch:\n${file.patch}`
        );
      } else {
        try {
          await octokit.rest.pulls.createReviewComment({
            ...repo,
            pull_number: pull_request.number,
            commit_id: lastCommitId,
            path: file.filename,
            body: response,
            position: getPatchLineLength(file.patch) - 1,
          });
          core.info(
            `Add Commit to File(${file.filename}): \n${response}\nwith patch:\n${file.patch}`
          );
        } catch (error) {
          core.warning(`Request Error: ${error.message}`);
        }
      }
    }
  }

  core.info(`[Time:End]: ${Date.now() - begin}`);
}

run().catch((error) => {
  core.setFailed(error.message);
});
