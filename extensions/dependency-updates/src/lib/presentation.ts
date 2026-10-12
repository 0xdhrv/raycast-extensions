import { Color, Icon, Image, List } from "@raycast/api";

import { CIStatus, DependencyPullRequest } from "../api/pull-requests";

import { PullRequestGroup } from "./group";
import { bumpType } from "./parse";

export function ciIcon(ci: CIStatus): Image.ImageLike {
  switch (ci) {
    case "passing":
      return { source: Icon.CheckCircle, tintColor: Color.Green };
    case "failing":
      return { source: Icon.XMarkCircle, tintColor: Color.Red };
    case "pending":
      return { source: Icon.Clock, tintColor: Color.Yellow };
    default:
      return { source: Icon.Circle, tintColor: Color.SecondaryText };
  }
}

export const ciLabel: Record<CIStatus, string> = {
  passing: "Checks passing",
  failing: "Checks failing",
  pending: "Checks pending",
  none: "No checks",
};

export function botLabel(pr: DependencyPullRequest) {
  return pr.bot === "dependabot" ? "Dependabot" : pr.bot === "renovate" ? "Renovate" : pr.author;
}

export function versionLabel(pr: DependencyPullRequest) {
  const { fromVersion, toVersion } = pr.parsed;
  if (fromVersion && toVersion) return `${fromVersion} → ${toVersion}`;
  if (toVersion) return `→ ${toVersion}`;
  return undefined;
}

const bumpColors = { major: Color.Red, minor: Color.Orange, patch: Color.Green } as const;

export function pullRequestAccessories(pr: DependencyPullRequest): List.Item.Accessory[] {
  const accessories: List.Item.Accessory[] = [];
  const bump = bumpType(pr.parsed.fromVersion, pr.parsed.toVersion);

  if (pr.parsed.isSecurity) accessories.push({ tag: { value: "Security", color: Color.Red } });
  if (bump) accessories.push({ tag: { value: bump, color: bumpColors[bump] }, tooltip: `${bump} update` });
  if (pr.parsed.directory) accessories.push({ text: pr.parsed.directory, tooltip: "Directory" });
  if (!pr.canWrite) accessories.push({ icon: Icon.Lock, tooltip: "You don't have write access" });
  if (pr.isDraft) accessories.push({ icon: Icon.Pencil, tooltip: "Draft" });
  if (pr.mergeable === "CONFLICTING") {
    accessories.push({ icon: { source: Icon.Warning, tintColor: Color.Orange }, tooltip: "Merge conflict" });
  }
  if (pr.reviewDecision === "APPROVED") {
    accessories.push({ icon: { source: Icon.CheckRosette, tintColor: Color.Green }, tooltip: "Approved" });
  }
  if (pr.autoMergeEnabled) {
    accessories.push({ icon: { source: Icon.Bolt, tintColor: Color.Purple }, tooltip: "Auto-merge enabled" });
  }
  accessories.push({ date: new Date(pr.createdAt), tooltip: `Opened by ${botLabel(pr)}` });
  accessories.push({ icon: ciIcon(pr.ci), tooltip: ciLabel[pr.ci] });
  return accessories;
}

export function groupAccessories(group: PullRequestGroup): List.Item.Accessory[] {
  const accessories: List.Item.Accessory[] = [];
  if (group.isSecurity) accessories.push({ tag: { value: "Security", color: Color.Red } });
  if (group.highestVersion) accessories.push({ tag: group.highestVersion, tooltip: "Highest target version" });
  if (group.counts.failing) {
    accessories.push({ icon: ciIcon("failing"), text: String(group.counts.failing), tooltip: ciLabel.failing });
  }
  if (group.counts.pending) {
    accessories.push({ icon: ciIcon("pending"), text: String(group.counts.pending), tooltip: ciLabel.pending });
  }
  if (group.counts.none) {
    accessories.push({ icon: ciIcon("none"), text: String(group.counts.none), tooltip: ciLabel.none });
  }
  if (group.counts.passing) {
    accessories.push({ icon: ciIcon("passing"), text: String(group.counts.passing), tooltip: ciLabel.passing });
  }
  return accessories;
}
