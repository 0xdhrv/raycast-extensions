import {
  Color,
  Icon,
  Keyboard,
  launchCommand,
  LaunchType,
  MenuBarExtra,
  open,
  openExtensionPreferences,
} from "@raycast/api";

import { withGitHubAuth } from "./api/github";
import { useDependencyPullRequests } from "./hooks/useDependencyPullRequests";
import { groupPullRequests } from "./lib/group";
import { ciIcon, ciLabel, versionLabel } from "./lib/presentation";

const MAX_GROUPS = 25;

function MenuBar() {
  const { pullRequests, isLoading, revalidate } = useDependencyPullRequests();
  const groups = groupPullRequests(pullRequests, "package");
  const failing = pullRequests.filter((pr) => pr.ci === "failing").length;

  const icon = {
    source: Icon.Box,
    tintColor: failing > 0 ? Color.Red : pullRequests.length > 0 ? Color.PrimaryText : Color.SecondaryText,
  };

  return (
    <MenuBarExtra
      icon={icon}
      title={pullRequests.length > 0 ? String(pullRequests.length) : undefined}
      tooltip={`${pullRequests.length} open dependency updates${failing ? `, ${failing} failing` : ""}`}
      isLoading={isLoading}
    >
      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Open Dependency Updates"
          icon={Icon.List}
          shortcut={Keyboard.Shortcut.Common.Open}
          onAction={() => launchCommand({ name: "inbox", type: LaunchType.UserInitiated })}
        />
      </MenuBarExtra.Section>
      <MenuBarExtra.Section
        title={`${pullRequests.length} open${failing ? ` · ${failing} failing` : ""} · ${groups.length} packages`}
      >
        {groups.length === 0 && !isLoading ? <MenuBarExtra.Item title="No open dependency updates" /> : null}
        {groups.slice(0, MAX_GROUPS).map((group) => (
          <MenuBarExtra.Submenu
            key={group.key}
            icon={ciIcon(
              group.counts.failing
                ? "failing"
                : group.counts.pending
                  ? "pending"
                  : group.counts.passing
                    ? "passing"
                    : "none",
            )}
            title={`${group.title}${group.highestVersion ? ` → ${group.highestVersion}` : ""} (${group.pullRequests.length})`}
          >
            {group.pullRequests.map((pr) => (
              <MenuBarExtra.Item
                key={pr.id}
                icon={ciIcon(pr.ci)}
                title={pr.repository}
                subtitle={versionLabel(pr)}
                tooltip={`${pr.title} — ${ciLabel[pr.ci]}`}
                onAction={() => open(pr.url)}
              />
            ))}
          </MenuBarExtra.Submenu>
        ))}
        {groups.length > MAX_GROUPS ? (
          <MenuBarExtra.Item
            title={`${groups.length - MAX_GROUPS} more packages…`}
            onAction={() => launchCommand({ name: "inbox", type: LaunchType.UserInitiated })}
          />
        ) : null}
      </MenuBarExtra.Section>
      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Refresh"
          icon={Icon.ArrowClockwise}
          shortcut={Keyboard.Shortcut.Common.Refresh}
          onAction={revalidate}
        />
        <MenuBarExtra.Item title="Configure Extension" icon={Icon.Gear} onAction={openExtensionPreferences} />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}

export default withGitHubAuth(MenuBar);
