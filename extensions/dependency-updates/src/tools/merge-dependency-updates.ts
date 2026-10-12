import { Action, Tool } from "@raycast/api";

import { withGitHubAuth } from "../api/github";
import { DependencyPullRequest, fetchDependencyPullRequests, resolveMergeMethod } from "../api/pull-requests";
import { approveAndMerge, Outcome } from "../lib/bulk";
import { mergeSkipReason } from "../lib/group";

type Input = {
  /**
   * The exact package name as returned by list-dependency-updates, for example "lodash" or "@types/node".
   */
  packageName: string;
  /**
   * Only merge pull requests whose CI checks pass. Defaults to true. Only set to false when the user explicitly asks to merge failing or pending updates.
   */
  onlyPassing?: boolean;
};

function skipReason(pr: DependencyPullRequest, onlyPassing: boolean) {
  if (onlyPassing) {
    return mergeSkipReason(pr);
  }
  if (!pr.canWrite) return "No write access";
  if (pr.isDraft) return "Draft";
  if (pr.mergeable === "CONFLICTING") return "Merge conflict";
  return undefined;
}

async function plan(input: Input) {
  const key = input.packageName.trim().toLowerCase();
  const all = await fetchDependencyPullRequests();
  const matching = all.filter((pr) => pr.parsed.key === key);

  if (matching.length === 0) {
    const suggestions = Array.from(
      new Set(all.filter((pr) => pr.parsed.key.includes(key)).map((pr) => pr.parsed.packageName)),
    );
    throw new Error(
      suggestions.length > 0
        ? `No dependency updates for "${input.packageName}". Did you mean: ${suggestions.slice(0, 10).join(", ")}?`
        : `No open dependency updates for "${input.packageName}".`,
    );
  }

  const onlyPassing = input.onlyPassing ?? true;
  const toMerge = matching.filter((pr) => !skipReason(pr, onlyPassing));
  const skipped = matching
    .filter((pr) => skipReason(pr, onlyPassing))
    .map((pr) => ({ pr, reason: skipReason(pr, onlyPassing) as string }));
  return { toMerge, skipped };
}

function describe(pr: DependencyPullRequest) {
  const version = pr.parsed.toVersion ? ` → ${pr.parsed.toVersion}` : "";
  return `${pr.repository}#${pr.number}${version} (${pr.ci}, ${resolveMergeMethod(pr).toLowerCase()})`;
}

export const confirmation: Tool.Confirmation<Input> = withGitHubAuth(async (input: Input) => {
  const { toMerge, skipped } = await plan(input);
  if (toMerge.length === 0) {
    // Nothing will be changed, so there's nothing to confirm
    return undefined;
  }
  return {
    style: Action.Style.Destructive,
    message: `Approve and merge ${toMerge.length} ${input.packageName} ${toMerge.length === 1 ? "update" : "updates"}?`,
    info: [
      ...toMerge.map((pr, index) => ({ name: `Merge ${index + 1}`, value: describe(pr) })),
      ...skipped.map(({ pr, reason }) => ({ name: "Skip", value: `${pr.repository}#${pr.number} (${reason})` })),
    ],
  };
});

/**
 * Approves and merges all open Dependabot / Renovate pull requests for a package, one at a time.
 */
export default withGitHubAuth(async (input: Input) => {
  const { toMerge, skipped } = await plan(input);
  const outcomes: Outcome[] = [];
  for (const pr of toMerge) {
    outcomes.push(await approveAndMerge(pr));
  }

  return {
    merged: outcomes.filter((o) => o.status === "merged").map((o) => o.pullRequest.url),
    failed: outcomes.filter((o) => o.status === "failed").map((o) => ({ url: o.pullRequest.url, error: o.message })),
    skipped: skipped.map(({ pr, reason }) => ({ url: pr.url, reason })),
  };
});
