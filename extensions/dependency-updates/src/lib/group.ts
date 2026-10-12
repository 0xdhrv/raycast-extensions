import { getPreferenceValues } from "@raycast/api";

import { Bot, CIStatus, DependencyPullRequest } from "../api/pull-requests";

import { highestVersion } from "./parse";

export type GroupBy = "package" | "repository";
export type Filter = "all" | "passing" | "failing" | "dependabot" | "renovate";
export type GroupStatus = "ready" | "pending" | "failing";

export type PullRequestGroup = {
  key: string;
  title: string;
  pullRequests: DependencyPullRequest[];
  highestVersion?: string;
  repositoryCount: number;
  counts: Record<CIStatus, number>;
  bots: Bot[];
  isSecurity: boolean;
  status: GroupStatus;
};

export function filterPullRequests(pullRequests: DependencyPullRequest[], filter: Filter) {
  switch (filter) {
    case "passing":
      return pullRequests.filter((pr) => pr.ci === "passing");
    case "failing":
      return pullRequests.filter((pr) => pr.ci === "failing" || pr.mergeable === "CONFLICTING");
    case "dependabot":
    case "renovate":
      return pullRequests.filter((pr) => pr.bot === filter);
    default:
      return pullRequests;
  }
}

/** Why a pull request would be skipped by "Approve and Merge All Passing", or undefined when it can be merged. */
export function mergeSkipReason(pr: DependencyPullRequest): string | undefined {
  const { treatNoChecksAsPassing } = getPreferenceValues<Preferences>();
  if (!pr.canWrite) return "No write access";
  if (pr.isDraft) return "Draft";
  if (pr.mergeable === "CONFLICTING") return "Merge conflict";
  if (pr.ci === "failing") return "CI failing";
  if (pr.ci === "pending") return "CI pending";
  if (pr.ci === "none" && !treatNoChecksAsPassing) return "No CI checks";
  return undefined;
}

/** Why a pull request would be skipped by "Enable Auto-Merge for All", or undefined when it is eligible. */
export function autoMergeSkipReason(pr: DependencyPullRequest): string | undefined {
  if (!pr.canWrite) return "No write access";
  if (pr.autoMergeEnabled) return "Auto-merge already enabled";
  if (pr.isDraft) return "Draft";
  if (pr.mergeable === "CONFLICTING") return "Merge conflict";
  if (pr.ci === "failing") return "CI failing";
  if (!pr.autoMergeAllowed) return "Auto-merge is disabled for this repository";
  return undefined;
}

function groupStatus(pullRequests: DependencyPullRequest[]): GroupStatus {
  if (pullRequests.some((pr) => pr.ci === "failing" || pr.mergeable === "CONFLICTING")) {
    return "failing";
  }
  if (pullRequests.every((pr) => !mergeSkipReason(pr))) {
    return "ready";
  }
  return "pending";
}

export function groupPullRequests(pullRequests: DependencyPullRequest[], groupBy: GroupBy): PullRequestGroup[] {
  const map = new Map<string, DependencyPullRequest[]>();
  const titles = new Map<string, string>();

  for (const pr of pullRequests) {
    const key = groupBy === "package" ? pr.parsed.key : pr.repository.toLowerCase();
    const list = map.get(key) ?? [];
    list.push(pr);
    map.set(key, list);
    if (!titles.has(key)) {
      titles.set(key, groupBy === "package" ? pr.parsed.packageName : pr.repository);
    }
  }

  return Array.from(map.entries())
    .map(([key, prs]) => {
      const counts: Record<CIStatus, number> = { passing: 0, failing: 0, pending: 0, none: 0 };
      prs.forEach((pr) => counts[pr.ci]++);
      return {
        key,
        title: titles.get(key) ?? key,
        pullRequests: prs,
        highestVersion: groupBy === "package" ? highestVersion(prs.map((pr) => pr.parsed.toVersion)) : undefined,
        repositoryCount: new Set(prs.map((pr) => pr.repository)).size,
        counts,
        bots: Array.from(new Set(prs.map((pr) => pr.bot))),
        isSecurity: prs.some((pr) => pr.parsed.isSecurity),
        status: groupStatus(prs),
      };
    })
    .sort((a, b) => b.pullRequests.length - a.pullRequests.length || a.title.localeCompare(b.title));
}

export function searchKeywords(group: PullRequestGroup) {
  return Array.from(
    new Set(group.pullRequests.flatMap((pr) => [pr.repository, ...pr.repository.split("/"), pr.parsed.packageName])),
  );
}
