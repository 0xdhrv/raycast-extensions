import { Action, ActionPanel, Icon, Keyboard, List } from "@raycast/api";
import { useState } from "react";

import { DependencyPullRequest } from "../api/pull-requests";
import { applyOutcomes, Outcome } from "../lib/bulk";
import { GroupBy } from "../lib/group";
import { botLabel, pullRequestAccessories, versionLabel } from "../lib/presentation";

import { GroupActions, PullRequestActions } from "./Actions";

export function PullRequestList(props: {
  title: string;
  groupBy: GroupBy;
  pullRequests: DependencyPullRequest[];
  onOutcomes: (outcomes: Outcome[]) => Promise<void>;
  onRefresh: () => void;
}) {
  const { title, groupBy } = props;
  // Pushed views don't re-render with new props, so keep a local copy that reflects actions immediately
  const [pullRequests, setPullRequests] = useState(props.pullRequests);

  async function handleOutcomes(outcomes: Outcome[]) {
    setPullRequests((current) => applyOutcomes(current, outcomes));
    await props.onOutcomes(outcomes);
  }

  return (
    <List navigationTitle={title} searchBarPlaceholder={`Filter ${title} updates`}>
      <List.EmptyView icon={Icon.CheckCircle} title="All done" description="No open pull requests left in this group" />
      {pullRequests.map((pr) => (
        <List.Item
          key={pr.id}
          icon={{ source: groupBy === "package" ? Icon.Folder : Icon.Box }}
          title={groupBy === "package" ? pr.repository : pr.parsed.packageName}
          subtitle={versionLabel(pr) ?? (pr.parsed.isFallback ? undefined : pr.title)}
          keywords={[pr.repository, pr.parsed.packageName, botLabel(pr), String(pr.number)]}
          accessories={pullRequestAccessories(pr)}
          actions={
            <ActionPanel>
              <PullRequestActions pullRequest={pr} onOutcomes={handleOutcomes} />
              <GroupActions title={title} pullRequests={pullRequests} onOutcomes={handleOutcomes} />
              <ActionPanel.Section>
                <Action
                  title="Refresh"
                  icon={Icon.ArrowClockwise}
                  shortcut={Keyboard.Shortcut.Common.Refresh}
                  onAction={props.onRefresh}
                />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
