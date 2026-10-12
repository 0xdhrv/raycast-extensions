import { withGitHubAuth } from "../api/github";
import { DependencyPullRequest, fetchDependencyPullRequests } from "../api/pull-requests";
import { groupPullRequests, mergeSkipReason } from "../lib/group";

type Input = {
  /**
   * Optional package name (or part of it) to filter by, for example "react" or "@types/node".
   */
  packageName?: string;
  /**
   * Optional CI status filter. "passing" = all checks succeeded, "failing" = failing checks or merge conflicts, "pending" = checks still running.
   */
  status?: "passing" | "failing" | "pending" | "all";
  /**
   * Optional bot filter.
   */
  bot?: "dependabot" | "renovate" | "all";
};

function matchesStatus(pr: DependencyPullRequest, status: Input["status"]) {
  switch (status) {
    case "passing":
      return pr.ci === "passing";
    case "failing":
      return pr.ci === "failing" || pr.mergeable === "CONFLICTING";
    case "pending":
      return pr.ci === "pending";
    default:
      return true;
  }
}

/**
 * Lists open Dependabot and Renovate pull requests across the user's repositories, grouped by package.
 */
export default withGitHubAuth(async (input: Input = {}) => {
  const query = input.packageName?.trim().toLowerCase();
  const pullRequests = (await fetchDependencyPullRequests()).filter(
    (pr) =>
      (!query || pr.parsed.key.includes(query)) &&
      matchesStatus(pr, input.status) &&
      (!input.bot || input.bot === "all" || pr.bot === input.bot),
  );

  return groupPullRequests(pullRequests, "package").map((group) => ({
    package: group.title,
    highestTargetVersion: group.highestVersion,
    repositories: group.repositoryCount,
    ci: group.counts,
    pullRequests: group.pullRequests.map((pr) => ({
      repository: pr.repository,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      bot: pr.bot,
      from: pr.parsed.fromVersion,
      to: pr.parsed.toVersion,
      ci: pr.ci,
      mergeable: pr.mergeable,
      reviewDecision: pr.reviewDecision,
      autoMergeEnabled: pr.autoMergeEnabled,
      readyToMerge: !mergeSkipReason(pr),
      notReadyReason: mergeSkipReason(pr),
      createdAt: pr.createdAt,
    })),
  }));
});
