import { Action, ActionPanel, Icon, Keyboard, List, openExtensionPreferences } from "@raycast/api";
import { useCachedState } from "@raycast/utils";
import { useMemo } from "react";

import { withGitHubAuth } from "./api/github";
import { MAX_PULL_REQUESTS } from "./api/pull-requests";
import { GroupActions } from "./components/Actions";
import { PullRequestList } from "./components/PullRequestList";
import { useDependencyPullRequests } from "./hooks/useDependencyPullRequests";
import { Filter, filterPullRequests, GroupBy, groupPullRequests, GroupStatus, searchKeywords } from "./lib/group";
import { groupAccessories } from "./lib/presentation";

const sections: { status: GroupStatus; title: string }[] = [
  { status: "ready", title: "Ready to Merge" },
  { status: "pending", title: "Waiting" },
  { status: "failing", title: "Needs Attention" },
];

function Inbox() {
  const { pullRequests, isLoading, error, revalidate, applyAndRevalidate } = useDependencyPullRequests();
  const [filter, setFilter] = useCachedState<Filter>("filter", "all");
  const [groupBy, setGroupBy] = useCachedState<GroupBy>("group-by", "package");

  const groups = useMemo(
    () => groupPullRequests(filterPullRequests(pullRequests, filter), groupBy),
    [pullRequests, filter, groupBy],
  );

  const otherGroupBy: GroupBy = groupBy === "package" ? "repository" : "package";

  return (
    <List
      isLoading={isLoading}
      navigationTitle={
        pullRequests.length >= MAX_PULL_REQUESTS
          ? `Dependency Updates (first ${MAX_PULL_REQUESTS})`
          : `Dependency Updates (${pullRequests.length})`
      }
      searchBarPlaceholder={
        groupBy === "package" ? "Filter by package or repository" : "Filter by repository or package"
      }
      searchBarAccessory={
        <List.Dropdown tooltip="Filter" value={filter} onChange={(value) => setFilter(value as Filter)}>
          <List.Dropdown.Item title="All" value="all" icon={Icon.List} />
          <List.Dropdown.Section>
            <List.Dropdown.Item title="Passing CI" value="passing" icon={Icon.CheckCircle} />
            <List.Dropdown.Item title="Failing or Conflicting" value="failing" icon={Icon.XMarkCircle} />
          </List.Dropdown.Section>
          <List.Dropdown.Section>
            <List.Dropdown.Item title="Dependabot" value="dependabot" icon={Icon.Box} />
            <List.Dropdown.Item title="Renovate" value="renovate" icon={Icon.Repeat} />
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {error && pullRequests.length === 0 ? (
        <List.EmptyView
          icon={Icon.Warning}
          title="Could not load dependency updates"
          description={error.message}
          actions={
            <ActionPanel>
              <Action title="Retry" icon={Icon.ArrowClockwise} onAction={revalidate} />
              <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
            </ActionPanel>
          }
        />
      ) : (
        <List.EmptyView
          icon={Icon.CheckCircle}
          title={filter === "all" ? "No open dependency updates" : "No dependency updates match this filter"}
          description="Open Dependabot and Renovate pull requests from your repositories show up here"
        />
      )}
      {sections.map(({ status, title }) => {
        const sectionGroups = groups.filter((g) => g.status === status);
        const count = sectionGroups.reduce((sum, g) => sum + g.pullRequests.length, 0);
        return (
          <List.Section key={status} title={title} subtitle={count ? `${count}` : undefined}>
            {sectionGroups.map((group) => (
              <List.Item
                key={group.key}
                icon={groupBy === "package" ? Icon.Box : Icon.Folder}
                title={group.title}
                subtitle={
                  groupBy === "package"
                    ? `${group.repositoryCount} ${group.repositoryCount === 1 ? "repo" : "repos"}`
                    : `${group.pullRequests.length} ${group.pullRequests.length === 1 ? "update" : "updates"}`
                }
                keywords={searchKeywords(group)}
                accessories={groupAccessories(group)}
                actions={
                  <ActionPanel>
                    <ActionPanel.Section>
                      <Action.Push
                        title="Show Pull Requests"
                        icon={Icon.List}
                        target={
                          <PullRequestList
                            title={group.title}
                            groupBy={groupBy}
                            pullRequests={group.pullRequests}
                            onOutcomes={applyAndRevalidate}
                            onRefresh={revalidate}
                          />
                        }
                      />
                    </ActionPanel.Section>
                    <GroupActions
                      title={group.title}
                      pullRequests={group.pullRequests}
                      onOutcomes={applyAndRevalidate}
                    />
                    <ActionPanel.Section>
                      <Action
                        title={`Group by ${otherGroupBy === "package" ? "Package" : "Repository"}`}
                        icon={otherGroupBy === "package" ? Icon.Box : Icon.Folder}
                        shortcut={{ modifiers: ["cmd"], key: "g" }}
                        onAction={() => setGroupBy(otherGroupBy)}
                      />
                      <Action
                        title="Refresh"
                        icon={Icon.ArrowClockwise}
                        shortcut={Keyboard.Shortcut.Common.Refresh}
                        onAction={revalidate}
                      />
                      <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
                    </ActionPanel.Section>
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        );
      })}
    </List>
  );
}

export default withGitHubAuth(Inbox);
