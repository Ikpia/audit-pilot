import { Octokit } from "@octokit/rest";
import { RequestError } from "@octokit/request-error";
import type { RepositoryTarget } from "./types";

const authenticatedOctokit = process.env.GITHUB_TOKEN
  ? new Octokit({ auth: process.env.GITHUB_TOKEN })
  : null;

const publicOctokit = new Octokit();
let disableAuthenticatedGitHubForSession = false;

export function parseGitHubUrl(repoUrl: string): RepositoryTarget {
  const url = new URL(repoUrl);

  if (url.hostname !== "github.com") {
    throw new Error("AuditPilot currently accepts GitHub repository URLs.");
  }

  const [owner, name] = url.pathname.replace(/^\/|\/$/g, "").split("/");

  if (!owner || !name) {
    throw new Error("Use a repository URL like https://github.com/owner/repo.");
  }

  return {
    owner,
    name: name.replace(/\.git$/, ""),
    url: `https://github.com/${owner}/${name.replace(/\.git$/, "")}`
  };
}

export async function fetchRepositoryTree(target: RepositoryTarget) {
  return withGitHubFallback(async (octokit) => {
    const repository = await octokit.repos.get({
      owner: target.owner,
      repo: target.name
    });

    const branch = repository.data.default_branch ?? "main";

    const tree = await octokit.git.getTree({
      owner: target.owner,
      repo: target.name,
      tree_sha: branch,
      recursive: "true"
    });

    return {
      defaultBranch: branch,
      files: tree.data.tree
        .filter((entry) => entry.type === "blob" && entry.path)
        .map((entry) => entry.path as string)
    };
  });
}

export async function fetchRepositoryFileText(
  target: RepositoryTarget,
  path: string,
  ref?: string
) {
  return withGitHubFallback(async (octokit) => {
    const file = await octokit.repos.getContent({
      owner: target.owner,
      repo: target.name,
      path,
      ref
    });

    if (Array.isArray(file.data) || file.data.type !== "file") {
      return "";
    }

    if (file.data.encoding === "base64" && file.data.content) {
      return Buffer.from(file.data.content, "base64").toString("utf8");
    }

    return "";
  });
}

async function withGitHubFallback<T>(operation: (octokit: Octokit) => Promise<T>) {
  if (!authenticatedOctokit || disableAuthenticatedGitHubForSession) {
    return operation(publicOctokit);
  }

  try {
    return await operation(authenticatedOctokit);
  } catch (error) {
    if (!isBadCredentialError(error)) {
      throw normalizeGitHubError(error);
    }

    disableAuthenticatedGitHubForSession = true;

    try {
      return await operation(publicOctokit);
    } catch (fallbackError) {
      throw normalizeGitHubError(fallbackError);
    }
  }
}

function isBadCredentialError(error: unknown) {
  return error instanceof RequestError && error.status === 401;
}

function normalizeGitHubError(error: unknown) {
  if (error instanceof RequestError) {
    if (error.status === 404) {
      return new Error("GitHub repository not found or not accessible. Use a public repo or configure a valid GITHUB_TOKEN.");
    }

    if (error.status === 403) {
      return new Error("GitHub rate limit or permissions blocked this request. Configure a valid GITHUB_TOKEN and try again.");
    }

    if (error.status === 401) {
      return new Error("GitHub rejected GITHUB_TOKEN. Remove it for public repos or replace it with a valid token.");
    }
  }

  return error instanceof Error ? error : new Error("GitHub repository inspection failed.");
}