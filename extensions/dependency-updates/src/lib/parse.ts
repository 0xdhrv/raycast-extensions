export type ParsedTitle = {
  /** Display name of the package (or update group) */
  packageName: string;
  /** Lower-cased key used to group pull requests across repositories */
  key: string;
  fromVersion?: string;
  toVersion?: string;
  /** Sub-directory for monorepo updates, e.g. "/frontend" */
  directory?: string;
  /** True for Dependabot grouped updates and Renovate monorepo / group updates */
  isGroup: boolean;
  isSecurity: boolean;
  /** True when the title could not be matched and the cleaned title is used as the package name */
  isFallback: boolean;
};

const CONVENTIONAL_PREFIX = /^[a-z]+(?:\([^)]*\))?!?:\s*/i;
const SECURITY_MARKER = /\[security\]/i;

// Renovate datasource words that precede the package name ("update dependency x", "update rust crate x")
const RENOVATE_LEADING = [
  "dependency",
  "dependencies",
  "devdependency",
  "module",
  "rust crate",
  "helm release",
  "docker image",
  "terraform",
  "gem",
  "plugin",
  "package",
  "image",
  "pre-commit hook",
];

// Renovate words that follow the package name ("update actions/checkout action to v4")
const RENOVATE_TRAILING = ["action", "docker tag", "digest", "orb", "packages", "image", "plugin", "hook"];

function cleanTitle(title: string) {
  return title
    .replace(SECURITY_MARKER, "")
    .trim()
    .replace(CONVENTIONAL_PREFIX, "")
    .replace(/\s+-\s+(autoclosed|abandoned)$/i, "")
    .replace(/\s+\([^)]*\)$/, "") // Renovate base branch suffix, e.g. "(main)"
    .replace(/\s+/g, " ")
    .trim();
}

function stripVersionPrefix(version: string) {
  return version.replace(/[.,]$/, "");
}

function result(packageName: string, partial: Partial<ParsedTitle>, isSecurity: boolean): ParsedTitle {
  const name = packageName.trim();
  return {
    packageName: name,
    key: name.toLowerCase(),
    isGroup: false,
    isFallback: false,
    isSecurity,
    ...partial,
  };
}

export function parseTitle(title: string): ParsedTitle {
  const isSecurity = SECURITY_MARKER.test(title);
  const cleaned = cleanTitle(title);
  let m: RegExpMatchArray | null;

  // Dependabot grouped updates: "Bump the npm_and_yarn group across 2 directories with 3 updates"
  m = cleaned.match(/^bump the (.+?) group(?: across \d+ director(?:y|ies))?(?: in (\S+))? with \d+ updates?$/i);
  if (m) {
    return result(`${m[1]} group`, { directory: m[2], isGroup: true }, isSecurity);
  }

  // Dependabot: "Bump lodash from 4.17.20 to 4.17.21 in /frontend"
  m = cleaned.match(/^bump (.+?) from (\S+) to (\S+?)(?: in (\S+))?$/i);
  if (m) {
    return result(
      m[1],
      { fromVersion: stripVersionPrefix(m[2]), toVersion: stripVersionPrefix(m[3]), directory: m[4] },
      isSecurity,
    );
  }

  // Dependabot requirement updates: "Update rails requirement from ~> 6.0 to ~> 7.0 in /app"
  m = cleaned.match(/^update (.+?) requirement from (.+?) to (.+?)(?: in (\/\S*))?$/i);
  if (m) {
    return result(m[1], { fromVersion: m[2], toVersion: m[3], directory: m[4] }, isSecurity);
  }

  // Dependabot multi-dependency: "Bump @babel/core and @babel/preset-env in /web"
  m = cleaned.match(/^bump (.+?)(?: in (\/\S*))?$/i);
  if (m) {
    return result(m[1], { directory: m[2], isGroup: / and /.test(m[1]) }, isSecurity);
  }

  // Renovate: "Update dependency react to v18.3.1", "Update typescript-eslint monorepo to v8.8.0"
  m = cleaned.match(/^update (.+?) to (\S+)$/i);
  if (m) {
    let name = m[1];
    let isGroup = false;

    const lower = () => name.toLowerCase();
    const leading = RENOVATE_LEADING.find((word) => lower().startsWith(`${word} `));
    if (leading) {
      name = name.slice(leading.length + 1);
    }

    if (lower().endsWith(" monorepo")) {
      name = name.slice(0, -" monorepo".length);
      isGroup = true;
    } else {
      const trailing = RENOVATE_TRAILING.find((word) => lower().endsWith(` ${word}`));
      if (trailing) {
        name = name.slice(0, -(trailing.length + 1));
      }
    }

    return result(name, { toVersion: stripVersionPrefix(m[2]), isGroup }, isSecurity);
  }

  // Renovate grouped updates without a single target: "Update all non-major dependencies"
  m = cleaned.match(/^update (.+)$/i);
  if (m) {
    return result(m[1], { isGroup: true }, isSecurity);
  }

  return result(cleaned || title, { isFallback: true }, isSecurity);
}

function versionParts(version: string) {
  const match = version.match(/\d+(?:\.\d+)*/);
  return match ? match[0].split(".").map(Number) : [];
}

/** Compares two loose version strings ("v1.2.3", "^4.0", "~> 7.0"). Non-numeric versions sort first. */
export function compareVersions(a: string, b: string) {
  const left = versionParts(a);
  const right = versionParts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

export function highestVersion(versions: (string | undefined)[]) {
  return versions
    .filter((v): v is string => Boolean(v))
    .reduce<string | undefined>((max, v) => (!max || compareVersions(v, max) > 0 ? v : max), undefined);
}

/** Classifies a version bump by comparing the first differing numeric component. */
export function bumpType(from?: string, to?: string): "major" | "minor" | "patch" | undefined {
  if (!from || !to) {
    return undefined;
  }
  const left = versionParts(from);
  const right = versionParts(to);
  if (left.length === 0 || right.length === 0) {
    return undefined;
  }
  if (left[0] !== right[0]) {
    return "major";
  }
  if ((left[1] ?? 0) !== (right[1] ?? 0)) {
    return "minor";
  }
  return "patch";
}
