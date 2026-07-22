import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { buildContractUnits, detectEcosystem } from "./detector";
import { enrichContractUnit, type ParsedContractRepository } from "./parser";

const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  "node_modules",
  "target",
  "dist",
  "build",
  "out",
  "coverage",
  "cache",
  "artifacts"
]);

const supportedExtensions = new Set([".sol", ".rs", ".toml", ".json", ".ts", ".js"]);
const MAX_DISCOVERED_FILES = 5_000;

export async function parseLocalContractRepository(repoPath: string): Promise<ParsedContractRepository> {
  const rootPath = await realpath(path.resolve(repoPath));
  const rootStats = await stat(rootPath);

  if (!rootStats.isDirectory()) {
    throw new Error(`Local repository path is not a directory: ${repoPath}`);
  }

  const files = await collectRelevantFiles(rootPath);
  const chain = detectEcosystem(files);
  const baseUnits = buildContractUnits(files, chain);

  const units = await Promise.all(
    baseUnits.map(async (unit) => {
      const source = await readFile(path.join(rootPath, ...unit.path.split("/")), "utf8");
      return enrichContractUnit(unit, chain, source);
    })
  );

  return {
    repository: {
      owner: "local",
      name: path.basename(rootPath),
      url: rootPath,
      defaultBranch: "local-worktree"
    },
    chain,
    units
  };
}

async function collectRelevantFiles(rootPath: string) {
  const files: string[] = [];

  async function walk(directory: string) {
    if (files.length >= MAX_DISCOVERED_FILES) {
      return;
    }

    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (files.length >= MAX_DISCOVERED_FILES) {
        return;
      }

      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          await walk(absolutePath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name);
      if (!supportedExtensions.has(extension)) {
        continue;
      }

      files.push(path.relative(rootPath, absolutePath).split(path.sep).join("/"));
    }
  }

  await walk(rootPath);
  return files;
}
