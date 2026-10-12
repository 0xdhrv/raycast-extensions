import {
  Action,
  ActionPanel,
  Alert,
  confirmAlert,
  getPreferenceValues,
  Icon,
  Keyboard,
  open,
  showToast,
  Toast,
} from "@raycast/api";
import { showFailureToast } from "@raycast/utils";

import { approvePullRequest, DependencyPullRequest } from "../api/pull-requests";
import { approveAndAutoMerge, approveAndMerge, autoMergeAll, mergeAllPassing, Outcome } from "../lib/bulk";
import { autoMergeSkipReason, mergeSkipReason } from "../lib/group";

const methodLabels: Record<string, string> = { SQUASH: "squash", MERGE: "merge commit", REBASE: "rebase" };

function summarizeSkips(pullRequests: DependencyPullRequest[], skipReason: (pr: DependencyPullRequest) => unknown) {
  const skipped = pullRequests.filter((pr) => skipReason(pr)).length;
  return skipped > 0 ? ` ${skipped} will be skipped (failing, pending, conflicting or read-only).` : "";
}

export function GroupActions(props: {
  title: string;
  pullRequests: DependencyPullRequest[];
  onOutcomes: (outcomes: Outcome[]) => void | Promise<void>;
}) {
  const { pullRequests, title, onOutcomes } = props;
  const { mergeMethod } = getPreferenceValues<Preferences>();
  const mergeable = pullRequests.filter((pr) => !mergeSkipReason(pr));
  const autoMergeable = pullRequests.filter((pr) => !autoMergeSkipReason(pr));

  async function handleMergeAll() {
    if (mergeable.length === 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Nothing ready to merge",
        message: "No pull request in this group has passing checks and no conflicts",
      });
      return;
    }
    const confirmed = await confirmAlert({
      title: `Merge ${mergeable.length} ${title} ${mergeable.length === 1 ? "update" : "updates"}?`,
      message: `Unapproved pull requests will be approved, then merged using ${methodLabels[mergeMethod ?? "SQUASH"]}.${summarizeSkips(pullRequests, mergeSkipReason)}`,
      icon: Icon.CheckCircle,
      primaryAction: { title: "Approve and Merge", style: Alert.ActionStyle.Default },
    });
    if (confirmed) {
      await onOutcomes(await mergeAllPassing(pullRequests));
    }
  }

  async function handleAutoMergeAll() {
    if (autoMergeable.length === 0) {
      await showToast({ style: Toast.Style.Failure, title: "No pull requests eligible for auto-merge" });
      return;
    }
    const confirmed = await confirmAlert({
      title: `Enable auto-merge for ${autoMergeable.length} ${autoMergeable.length === 1 ? "pull request" : "pull requests"}?`,
      message: `Unapproved pull requests will be approved so they merge as soon as checks pass. Pull requests that are already mergeable are merged right away.${summarizeSkips(pullRequests, autoMergeSkipReason)}`,
      icon: Icon.Bolt,
      primaryAction: { title: "Enable Auto-Merge" },
    });
    if (confirmed) {
      await onOutcomes(await autoMergeAll(pullRequests));
    }
  }

  async function handleOpenAll() {
    if (
      pullRequests.length > 10 &&
      !(await confirmAlert({ title: `Open ${pullRequests.length} pull requests in your browser?` }))
    ) {
      return;
    }
    for (const pr of pullRequests) {
      await open(pr.url);
    }
  }

  return (
    <ActionPanel.Section
      title={`${pullRequests.length} ${pullRequests.length === 1 ? "Pull Request" : "Pull Requests"}`}
    >
      <Action
        title={`Approve and Merge All Passing (${mergeable.length})`}
        icon={Icon.CheckCircle}
        shortcut={{ modifiers: ["cmd", "shift"], key: "return" }}
        onAction={handleMergeAll}
      />
      <Action
        title={`Enable Auto-Merge for All (${autoMergeable.length})`}
        icon={Icon.Bolt}
        shortcut={{ modifiers: ["cmd", "opt"], key: "return" }}
        onAction={handleAutoMergeAll}
      />
      <Action
        title="Open All in Browser"
        icon={Icon.Globe}
        shortcut={{ modifiers: ["cmd", "opt"], key: "o" }}
        onAction={handleOpenAll}
      />
    </ActionPanel.Section>
  );
}

async function runSingle(
  pr: DependencyPullRequest,
  title: string,
  run: () => Promise<Outcome>,
  onOutcomes: (outcomes: Outcome[]) => void | Promise<void>,
) {
  const toast = await showToast({ style: Toast.Style.Animated, title, message: `${pr.repository}#${pr.number}` });
  const outcome = await run();
  if (outcome.status === "failed") {
    toast.style = Toast.Style.Failure;
    toast.title = `${title} failed`;
    toast.message = outcome.message;
  } else {
    toast.style = Toast.Style.Success;
    toast.title =
      outcome.status === "merged" ? "Merged" : outcome.status === "auto-merge" ? "Auto-merge enabled" : "Approved";
  }
  await onOutcomes([outcome]);
}

export function PullRequestActions(props: {
  pullRequest: DependencyPullRequest;
  onOutcomes: (outcomes: Outcome[]) => void | Promise<void>;
}) {
  const { pullRequest: pr, onOutcomes } = props;

  async function approve(): Promise<Outcome> {
    try {
      await approvePullRequest(pr);
      return { pullRequest: pr, status: "approved" };
    } catch (error) {
      return { pullRequest: pr, status: "failed", message: error instanceof Error ? error.message : String(error) };
    }
  }

  async function merge() {
    const reason = mergeSkipReason(pr);
    if (
      reason &&
      !(await confirmAlert({
        title: "Merge anyway?",
        message: `${pr.repository}#${pr.number}: ${reason}.`,
        primaryAction: { title: "Merge", style: Alert.ActionStyle.Destructive },
      }))
    ) {
      return;
    }
    await runSingle(pr, "Merging", () => approveAndMerge(pr), onOutcomes);
  }

  return (
    <ActionPanel.Section title={`${pr.repository}#${pr.number}`}>
      <Action.OpenInBrowser url={pr.url} />
      {pr.reviewDecision !== "APPROVED" ? (
        <Action
          title="Approve"
          icon={Icon.CheckRosette}
          shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
          onAction={() => runSingle(pr, "Approving", approve, onOutcomes).catch((e) => showFailureToast(e))}
        />
      ) : null}
      <Action
        title="Approve and Merge"
        icon={Icon.CheckCircle}
        shortcut={{ modifiers: ["cmd", "shift"], key: "m" }}
        onAction={() => merge().catch((e) => showFailureToast(e))}
      />
      {!pr.autoMergeEnabled ? (
        <Action
          title="Enable Auto-Merge"
          icon={Icon.Bolt}
          shortcut={{ modifiers: ["cmd", "shift"], key: "e" }}
          onAction={() =>
            runSingle(pr, "Enabling auto-merge", () => approveAndAutoMerge(pr), onOutcomes).catch((e) =>
              showFailureToast(e),
            )
          }
        />
      ) : null}
      <Action.CopyToClipboard title="Copy URL" content={pr.url} shortcut={Keyboard.Shortcut.Common.Copy} />
      <Action.OpenInBrowser
        title="Open Repository"
        url={pr.repositoryUrl}
        icon={Icon.Code}
        shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
      />
    </ActionPanel.Section>
  );
}
