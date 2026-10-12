import { getPreferenceValues } from "@raycast/api";

import { parseTitle, ParsedTitle } from "../lib/parse";

import { graphql } from "./github";

export const MAX_PULL_REQUESTS = 300;
const PAGE_SIZE = 50;
const MAX_QUERY_LENGTH = 250; // GitHub search queries are limited to 256 characters

export type MergeMethod = "SQUASH" | "MERGE" | "REBASE";
export type Bot = "dependabot" | "renovate" | "other";
export type CheckState = "SUCCESS" | "FAILURE" | "ERROR" | "PENDING" | "EXPECTED" | "NONE";
export type CIStatus = "passing" | "failing" | "pending" | "none";

export type DependencyPullRequest = {
  id: string;
  title: string;
  url: string;
  number: number;
  createdAt: string;
  isDraft: boolean;
  author: string;
  bot: Bot;
  repository: string;
  repositoryUrl: string;
  canWrite: boolean;
  allowedMergeMethods: MergeMethod[];
  autoMergeAllowed: boolean;
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  mergeStateStatus: string;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  checkState: CheckState;
  ci: CIStatus;
  autoMergeEnabled: boolean;
  parsed: ParsedTitle;
};

type SearchNode = {
  __typename: string;
  id: string;
  title: string;
  url: string;
  number: number;
  state: "OPEN" | "CLOSED" | "MERGED";
  createdAt: string;
  isDraft: boolean;
  mergeable: DependencyPullRequest["mergeable"];
  mergeStateStatus: string;
  reviewDecision: DependencyPullRequest["reviewDecision"];
  author: { login: string } | null;
  autoMergeRequest: { enabledAt: string } | null;
  repository: {
    nameWithOwner: string;
    url: string;
    viewerPermission: string | null;
    autoMergeAllowed: boolean;
    squashMergeAllowed: boolean;
    mergeCommitAllowed: boolean;
    rebaseMergeAllowed: boolean;
  };
  commits: { nodes: { commit: { statusCheckRollup: { state: CheckState } | null } }[] };
};

type SearchResponse = {
  search: {
    issueCount: number;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: SearchNode[];
  };
};

const SEARCH_QUERY = /* GraphQL */ `
  query DependencyPullRequests($query: String!, $first: Int!, $after: String) {
    search(query: $query, type: ISSUE, first: $first, after: $after) {
      issueCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        __typename
        ... on PullRequest {
          id
          title
          url
          number
          state
          createdAt
          isDraft
          mergeable
          mergeStateStatus
          reviewDecision
          author {
            login
          }
          autoMergeRequest {
            enabledAt
          }
          repository {
            nameWithOwner
            url
            viewerPermission
            autoMergeAllowed
            squashMergeAllowed
            mergeCommitAllowed
            rebaseMergeAllowed
          }
          commits(last: 1) {
            nodes {
              commit {
                statusCheckRollup {
                  state
                }
              }
            }
          }
        }
      }
    }
  }
`;

const VIEWER_QUERY = /* GraphQL */ `
  query Viewer {
    viewer {
      login
      organizations(first: 100) {
        nodes {
          login
        }
      }
    }
  }
`;

function splitList(value?: string) {
  return (value ?? "")
    .split(/[,\s]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function getAuthors() {
  const { additionalAuthors } = getPreferenceValues<Preferences>();
  return Array.from(new Set(["app/dependabot", "app/renovate", ...splitList(additionalAuthors)]));
}

async function getOwners(): Promise<string[]> {
  const { owners } = getPreferenceValues<Preferences>();
  const configured = splitList(owners);
  if (configured.length > 0) {
    return configured;
  }

  const { viewer } = await graphql<{ viewer: { login: string; organizations: { nodes: { login: string }[] } } }>(
    VIEWER_QUERY,
    {},
    { allowPartialData: true },
  );
  return [viewer.login, ...(viewer.organizations?.nodes ?? []).filter(Boolean).map((o) => o.login)];
}

/** Splits owners into `user:` qualifier chunks so every search query stays under GitHub's length limit. */
export function buildSearchQueries(authors: string[], owners: string[]) {
  const queries: string[] = [];
  for (const author of authors) {
    const base = `is:pr is:open archived:false author:${author}`;
    let current = base;
    for (const owner of owners) {
      const qualifier = ` user:${owner}`;
      if (current !== base && current.length + qualifier.length > MAX_QUERY_LENGTH) {
        queries.push(current);
        current = base;
      }
      current += qualifier;
    }
    queries.push(current);
  }
  return queries;
}

function classifyBot(login: string): Bot {
  const lower = login.toLowerCase();
  if (lower.includes("dependabot")) return "dependabot";
  if (lower.includes("renovate")) return "renovate";
  return "other";
}

function toCIStatus(state: CheckState): CIStatus {
  switch (state) {
    case "SUCCESS":
      return "passing";
    case "FAILURE":
    case "ERROR":
      return "failing";
    case "PENDING":
    case "EXPECTED":
      return "pending";
    default:
      return "none";
  }
}

function toPullRequest(node: SearchNode): DependencyPullRequest {
  const repo = node.repository;
  const checkState = node.commits.nodes[0]?.commit.statusCheckRollup?.state ?? "NONE";
  const allowedMergeMethods: MergeMethod[] = [];
  if (repo.squashMergeAllowed) allowedMergeMethods.push("SQUASH");
  if (repo.mergeCommitAllowed) allowedMergeMethods.push("MERGE");
  if (repo.rebaseMergeAllowed) allowedMergeMethods.push("REBASE");

  return {
    id: node.id,
    title: node.title,
    url: node.url,
    number: node.number,
    createdAt: node.createdAt,
    isDraft: node.isDraft,
    author: node.author?.login ?? "ghost",
    bot: classifyBot(node.author?.login ?? ""),
    repository: repo.nameWithOwner,
    repositoryUrl: repo.url,
    canWrite: ["ADMIN", "MAINTAIN", "WRITE"].includes(repo.viewerPermission ?? ""),
    allowedMergeMethods,
    autoMergeAllowed: repo.autoMergeAllowed,
    mergeable: node.mergeable,
    mergeStateStatus: node.mergeStateStatus,
    reviewDecision: node.reviewDecision,
    checkState,
    ci: toCIStatus(checkState),
    autoMergeEnabled: Boolean(node.autoMergeRequest),
    parsed: parseTitle(node.title),
  };
}

async function searchAll(query: string, limit: number): Promise<SearchNode[]> {
  const nodes: SearchNode[] = [];
  let after: string | null = null;
  while (nodes.length < limit) {
    const data: SearchResponse = await graphql<SearchResponse>(
      SEARCH_QUERY,
      { query, first: Math.min(PAGE_SIZE, limit - nodes.length), after },
      // Organizations with SAML enforcement return errors next to the results we can read
      { allowPartialData: true },
    );
    nodes.push(...data.search.nodes.filter((n) => n?.__typename === "PullRequest" && n.state === "OPEN"));
    if (!data.search.pageInfo.hasNextPage || !data.search.pageInfo.endCursor) {
      break;
    }
    after = data.search.pageInfo.endCursor;
  }
  return nodes;
}

export async function fetchDependencyPullRequests(): Promise<DependencyPullRequest[]> {
  const owners = await getOwners();
  const queries = buildSearchQueries(getAuthors(), owners);

  const seen = new Map<string, DependencyPullRequest>();
  // Run sequentially to stay well clear of GitHub's secondary rate limits on search
  for (const query of queries) {
    if (seen.size >= MAX_PULL_REQUESTS) break;
    const nodes = await searchAll(query, MAX_PULL_REQUESTS - seen.size);
    for (const node of nodes) {
      if (!seen.has(node.id)) {
        seen.set(node.id, toPullRequest(node));
      }
    }
  }

  return Array.from(seen.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Mutations

const APPROVE_MUTATION = /* GraphQL */ `
  mutation Approve($id: ID!) {
    addPullRequestReview(input: { pullRequestId: $id, event: APPROVE }) {
      clientMutationId
    }
  }
`;

const MERGE_MUTATION = /* GraphQL */ `
  mutation Merge($id: ID!, $method: PullRequestMergeMethod!) {
    mergePullRequest(input: { pullRequestId: $id, mergeMethod: $method }) {
      clientMutationId
    }
  }
`;

const AUTO_MERGE_MUTATION = /* GraphQL */ `
  mutation AutoMerge($id: ID!, $method: PullRequestMergeMethod!) {
    enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: $method }) {
      clientMutationId
    }
  }
`;

/** Picks the preferred merge method, falling back to one the repository allows. */
export function resolveMergeMethod(pr: DependencyPullRequest): MergeMethod {
  const { mergeMethod } = getPreferenceValues<Preferences>();
  const preferred = (mergeMethod ?? "SQUASH") as MergeMethod;
  if (pr.allowedMergeMethods.length === 0 || pr.allowedMergeMethods.includes(preferred)) {
    return preferred;
  }
  return pr.allowedMergeMethods[0];
}

export async function approvePullRequest(pr: DependencyPullRequest) {
  await graphql(APPROVE_MUTATION, { id: pr.id });
}

export async function mergePullRequest(pr: DependencyPullRequest) {
  await graphql(MERGE_MUTATION, { id: pr.id, method: resolveMergeMethod(pr) });
}

export async function enableAutoMerge(pr: DependencyPullRequest) {
  await graphql(AUTO_MERGE_MUTATION, { id: pr.id, method: resolveMergeMethod(pr) });
}
