import { Clipboard, showToast, Toast } from "@raycast/api";

import { approvePullRequest, DependencyPullRequest, enableAutoMerge, mergePullRequest } from "../api/pull-requests";

import { autoMergeSkipReason, mergeSkipReason } from "./group";

export type OutcomeStatus = "merged" | "approved" | "auto-merge" | "skipped" | "failed";

export type Outcome = {
  pullRequest: DependencyPullRequest;
  status: OutcomeStatus;
  message?: string;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.split("\n")[0] : String(error);
}

async function approveIfNeeded(pr: DependencyPullRequest) {
  if (pr.reviewDecision !== "APPROVED") {
    await approvePullRequest(pr);
  }
}

/** Approves (when needed) and merges a single pull request. */
export async function approveAndMerge(pr: DependencyPullRequest): Promise<Outcome> {
  try {
    await approveIfNeeded(pr);
  } catch (error) {
    // Approval can fail (e.g. reviews are not required, or the viewer cannot approve). Try merging anyway.
    try {
      await mergePullRequest(pr);
      return { pullRequest: pr, status: "merged" };
    } catch (mergeError) {
      return { pullRequest: pr, status: "failed", message: `${errorMessage(error)} / ${errorMessage(mergeError)}` };
    }
  }
  try {
    await mergePullRequest(pr);
    return { pullRequest: pr, status: "merged" };
  } catch (error) {
    return { pullRequest: pr, status: "failed", message: errorMessage(error) };
  }
}

/** Approves (when needed) and enables auto-merge. Pull requests that are already mergeable are merged right away. */
export async function approveAndAutoMerge(pr: DependencyPullRequest): Promise<Outcome> {
  try {
    await approveIfNeeded(pr);
  } catch {
    // Ignore: auto-merge may still be possible without our review
  }
  try {
    await enableAutoMerge(pr);
    return { pullRequest: pr, status: "auto-merge" };
  } catch (error) {
    const message = errorMessage(error);
    // GitHub refuses auto-merge for pull requests that can be merged immediately ("clean status")
    if (/clean status/i.test(message)) {
      try {
        await mergePullRequest(pr);
        return { pullRequest: pr, status: "merged" };
      } catch (mergeError) {
        return { pullRequest: pr, status: "failed", message: errorMessage(mergeError) };
      }
    }
    return { pullRequest: pr, status: "failed", message };
  }
}

type BulkOptions = {
  verb: string;
  skipReason: (pr: DependencyPullRequest) => string | undefined;
  run: (pr: DependencyPullRequest) => Promise<Outcome>;
};

function label(pr: DependencyPullRequest) {
  return `${pr.repository}#${pr.number}`;
}

export function formatReport(outcomes: Outcome[]) {
  return outcomes
    .map((o) => `${o.status.toUpperCase().padEnd(10)} ${label(o.pullRequest)} ${o.message ? `- ${o.message}` : ""}`)
    .join("\n");
}

async function runBulk(pullRequests: DependencyPullRequest[], options: BulkOptions): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];
  const eligible: DependencyPullRequest[] = [];

  for (const pr of pullRequests) {
    const reason = options.skipReason(pr);
    if (reason) {
      outcomes.push({ pullRequest: pr, status: "skipped", message: reason });
    } else {
      eligible.push(pr);
    }
  }

  const toast = await showToast({ style: Toast.Style.Animated, title: `${options.verb} 0/${eligible.length}` });

  for (const [index, pr] of eligible.entries()) {
    toast.title = `${options.verb} ${index + 1}/${eligible.length}`;
    toast.message = label(pr);
    // Sequential on purpose: merging several PRs in the same repository in parallel causes avoidable conflicts
    outcomes.push(await options.run(pr));
  }

  const done = outcomes.filter((o) => o.status === "merged" || o.status === "auto-merge").length;
  const skipped = outcomes.filter((o) => o.status === "skipped").length;
  const failed = outcomes.filter((o) => o.status === "failed").length;

  toast.style = failed > 0 ? Toast.Style.Failure : Toast.Style.Success;
  toast.title = `${options.verb} done: ${done} of ${pullRequests.length}`;
  toast.message = [skipped && `${skipped} skipped`, failed && `${failed} failed`].filter(Boolean).join(", ");
  toast.primaryAction = {
    title: "Copy Report",
    onAction: async (t) => {
      await Clipboard.copy(formatReport(outcomes));
      await t.hide();
    },
  };

  return outcomes;
}

export function mergeAllPassing(pullRequests: DependencyPullRequest[]) {
  return runBulk(pullRequests, { verb: "Merging", skipReason: mergeSkipReason, run: approveAndMerge });
}

export function autoMergeAll(pullRequests: DependencyPullRequest[]) {
  return runBulk(pullRequests, {
    verb: "Enabling auto-merge",
    skipReason: autoMergeSkipReason,
    run: approveAndAutoMerge,
  });
}

/** Applies the result of actions to a list of pull requests without waiting for a refetch. */
export function applyOutcomes(pullRequests: DependencyPullRequest[], outcomes: Outcome[]): DependencyPullRequest[] {
  const byId = new Map(outcomes.map((o) => [o.pullRequest.id, o]));
  return pullRequests
    .filter((pr) => byId.get(pr.id)?.status !== "merged")
    .map((pr) => {
      const outcome = byId.get(pr.id);
      if (outcome?.status === "auto-merge") return { ...pr, autoMergeEnabled: true };
      if (outcome?.status === "approved") return { ...pr, reviewDecision: "APPROVED" };
      return pr;
    });
}
