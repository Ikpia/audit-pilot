export type SoloditSearchParams = {
  query: string;
  language?: "solidity" | "rust";
  severity?: string;
  limit?: number;
};

export type SoloditFinding = {
  title: string;
  severity?: string;
  source?: string;
  url?: string;
  summary?: string;
};

type RawSoloditFinding = Record<string, unknown>;

const DEFAULT_SOLODIT_API_URL = "https://solodit.cyfrin.io/api/v1/solodit";
const DEFAULT_PAGE_SIZE = 20;

export async function searchSoloditFindings(params: SoloditSearchParams) {
  const apiKey = process.env.SOLODIT_API_KEY || process.env.CYFRIN_API_KEY;

  if (!apiKey || process.env.AUDITPILOT_USE_SOLODIT !== "true") {
    return [] satisfies SoloditFinding[];
  }

  const baseUrl = trimTrailingSlash(process.env.SOLODIT_API_URL || DEFAULT_SOLODIT_API_URL);
  const response = await fetch(`${baseUrl}/findings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Cyfrin-API-Key": apiKey
    },
    body: JSON.stringify({
      page: 1,
      pageSize: Math.max(params.limit ?? 5, DEFAULT_PAGE_SIZE),
      filters: {}
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Solodit findings lookup failed: ${response.status} ${body}`);
  }

  const payload = (await response.json()) as { findings?: RawSoloditFinding[] };
  const findings = payload.findings ?? [];

  return rankFindings(findings, params)
    .slice(0, params.limit ?? 5)
    .map(normalizeFinding);
}

function rankFindings(findings: RawSoloditFinding[], params: SoloditSearchParams) {
  const queryTerms = tokenize(params.query);
  const severity = params.severity?.toLowerCase();
  const language = params.language?.toLowerCase();

  return findings
    .map((finding) => ({
      finding,
      score:
        scoreText(finding, queryTerms) +
        scoreSeverity(finding, severity) +
        scoreLanguage(finding, language)
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ finding }) => finding);
}

function normalizeFinding(finding: RawSoloditFinding): SoloditFinding {
  return {
    title: stringValue(finding.title) || "Solodit finding",
    severity: stringValue(finding.impact) || stringValue(finding.severity),
    source: stringValue(finding.firm_name) || stringValue(finding.source),
    url:
      stringValue(finding.url) ||
      stringValue(finding.finding_url) ||
      stringValue(finding.report_url),
    summary: stringValue(finding.summary) || clip(stringValue(finding.content), 260)
  };
}

function scoreText(finding: RawSoloditFinding, terms: string[]) {
  if (terms.length === 0) return 0;

  const searchable = [
    finding.title,
    finding.summary,
    finding.content,
    finding.protocol_name,
    finding.sponsor_name,
    finding.firm_name,
    JSON.stringify(finding.issues_issuetagscore ?? [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return terms.reduce((score, term) => score + (searchable.includes(term) ? 1 : 0), 0);
}

function scoreSeverity(finding: RawSoloditFinding, severity?: string) {
  if (!severity) return 0;
  const impact = `${stringValue(finding.impact)} ${stringValue(finding.severity)}`.toLowerCase();
  return impact.includes(severity) ? 2 : 0;
}

function scoreLanguage(finding: RawSoloditFinding, language?: string) {
  if (!language) return 0;
  const searchable = JSON.stringify(finding).toLowerCase();
  return searchable.includes(language) ? 2 : 0;
}

function tokenize(input: string) {
  return input
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((term) => term.length > 3)
    .slice(0, 18);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clip(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}