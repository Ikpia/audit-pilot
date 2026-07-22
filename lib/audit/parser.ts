import { buildContractUnits, detectEcosystem } from "./detector";
import { fetchRepositoryFileText, fetchRepositoryTree, parseGitHubUrl } from "./github";
import type { ContractUnit, SmartContractEcosystem } from "./types";

const MAX_SOURCE_CHARS = 80_000;

export type ParsedContractRepository = {
  repository: {
    owner: string;
    name: string;
    url: string;
    defaultBranch: string;
  };
  chain: SmartContractEcosystem;
  units: ContractUnit[];
};

export async function parseContractRepository(repoUrl: string): Promise<ParsedContractRepository> {
  const repository = parseGitHubUrl(repoUrl);
  const tree = await fetchRepositoryTree(repository);
  const chain = detectEcosystem(tree.files);
  const baseUnits = buildContractUnits(tree.files, chain);

  const units = await Promise.all(
    baseUnits.map(async (unit) => {
      const source = await fetchRepositoryFileText(repository, unit.path, tree.defaultBranch);
      return enrichContractUnit(unit, chain, source);
    })
  );

  return {
    repository: {
      ...repository,
      defaultBranch: tree.defaultBranch
    },
    chain,
    units
  };
}

export function enrichContractUnit(
  unit: ContractUnit,
  chain: SmartContractEcosystem,
  sourceCode: string
): ContractUnit {
  const truncated = sourceCode.length > MAX_SOURCE_CHARS;
  const source = truncated ? sourceCode.slice(0, MAX_SOURCE_CHARS) : sourceCode;

  return {
    ...unit,
    unitName: inferUnitName(unit.path, chain, source),
    sourceCode: source,
    externalCalls: inferExternalCalls(chain, source),
    metadata: {
      framework: chain === "solana" ? "anchor-or-native-solana" : chain === "solidity" ? "evm" : undefined,
      imports: inferImports(chain, source),
      functions: inferFunctions(chain, source),
      lineCount: sourceCode ? sourceCode.split(/\r?\n/).length : 0,
      sourceTruncated: truncated
    }
  };
}

function inferUnitName(path: string, chain: SmartContractEcosystem, source: string) {
  if (chain === "solidity") {
    return firstMatch(source, /\b(?:contract|interface|library)\s+([A-Za-z_][A-Za-z0-9_]*)/);
  }

  if (chain === "solana") {
    return firstMatch(source, /declare_id!\("([A-Za-z0-9]+)"\)/) || path.split("/")[1];
  }

  return path.split("/").pop() ?? path;
}

function inferImports(chain: SmartContractEcosystem, source: string) {
  const pattern = chain === "solidity" ? /^\s*import\s+[^;]+;/gm : /^\s*use\s+[^;]+;/gm;
  return Array.from(source.matchAll(pattern)).map((match) => match[0].trim()).slice(0, 40);
}

function inferFunctions(chain: SmartContractEcosystem, source: string) {
  const pattern =
    chain === "solidity"
      ? /\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g
      : /\bpub\s+fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;

  return Array.from(source.matchAll(pattern)).map((match) => match[1]).slice(0, 80);
}

function inferExternalCalls(chain: SmartContractEcosystem, source: string) {
  const patterns =
    chain === "solidity"
      ? [
          /\.call\s*\{/g,
          /\.delegatecall\s*\(/g,
          /\.staticcall\s*\(/g,
          /\.transfer\s*\(/g,
          /\.send\s*\(/g,
          /safeTransferFrom\s*\(/g,
          /safeTransfer\s*\(/g
        ]
      : [
          /invoke_signed\s*\(/g,
          /invoke\s*\(/g,
          /CpiContext::new/g,
          /token::transfer\s*\(/g,
          /system_program::transfer\s*\(/g
        ];

  const calls = patterns
    .filter((pattern) => pattern.test(source))
    .map((pattern) => pattern.source.replace(/\\s\*|\\|\{|\}|\(|\)|\[|\]|\^|\$|\.\*/g, ""));

  return Array.from(new Set(calls));
}

function firstMatch(source: string, pattern: RegExp) {
  return source.match(pattern)?.[1];
}
