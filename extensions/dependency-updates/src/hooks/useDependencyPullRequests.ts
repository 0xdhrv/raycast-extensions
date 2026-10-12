import { useCachedPromise } from "@raycast/utils";

import { fetchDependencyPullRequests } from "../api/pull-requests";
import { applyOutcomes, Outcome } from "../lib/bulk";

export function useDependencyPullRequests() {
  const { data, isLoading, error, mutate, revalidate } = useCachedPromise(fetchDependencyPullRequests, [], {
    keepPreviousData: true,
    failureToastOptions: { title: "Could not load dependency updates" },
  });

  /** Reflects action results immediately, then refetches from GitHub. */
  async function applyAndRevalidate(outcomes: Outcome[]) {
    await mutate(undefined, { optimisticUpdate: (current) => applyOutcomes(current ?? [], outcomes) });
  }

  return { pullRequests: data ?? [], isLoading, error, revalidate, applyAndRevalidate };
}
