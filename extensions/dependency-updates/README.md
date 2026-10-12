# Dependency Updates

Triage every open [Dependabot](https://docs.github.com/en/code-security/dependabot) and [Renovate](https://docs.renovatebot.com/) pull request across all of your GitHub repositories in one place. Pull requests are grouped by package, so bumping `typescript` in 14 repositories is one decision instead of 14.

## Commands

- **Dependency Updates**: lists open dependency pull requests grouped by package (or by repository with `⌘ G`). Groups are split into _Ready to Merge_, _Waiting_ and _Needs Attention_, and show the number of repositories, the highest target version and CI status. Filter by passing or failing CI, or by bot.
  - **Approve and Merge All Passing**: approves and merges every pull request in the group whose checks pass and that has no conflicts. Pull requests are merged one at a time and a report can be copied from the final toast.
  - **Enable Auto-Merge for All**: approves and enables auto-merge so pull requests merge as soon as checks pass. Pull requests that are already mergeable are merged right away.
  - Open a group to approve, merge, enable auto-merge, open or copy individual pull requests.
- **Dependency Updates Menu Bar**: shows the number of open dependency pull requests (the icon turns red when some are failing), grouped by package. Refreshes every 10 minutes.

## AI Tools

- **List Dependency Updates**: "Which dependency updates are failing CI?"
- **Merge Dependency Updates**: "Merge all the passing lodash updates." Shows the pull requests that will be merged and skipped before anything happens.

## Authentication

Sign in with GitHub when you first open a command. The extension requests the `repo` and `read:org` scopes so it can see private repositories, list your organizations, and approve and merge pull requests.

You can use a [personal access token](https://github.com/settings/tokens/new?scopes=repo,read:org&description=Raycast%20Dependency%20Updates) instead by setting **GitHub Token** in the extension preferences.

If an organization restricts OAuth app access or enforces SAML single sign-on, its pull requests won't appear until the Raycast app is approved for that organization (or your token is authorized for SSO).

## Preferences

| Preference | Description |
| --- | --- |
| Owners | Comma-separated users or organizations to search, e.g. `raycast, 0xdhrv`. Leave empty to search your own account and every organization you belong to. |
| Merge Method | Squash (default), merge commit or rebase. If a repository doesn't allow the preferred method, an allowed one is used. |
| Additional Bot Authors | Extra authors to include, for self-hosted Renovate or custom bots, e.g. `app/my-renovate`. |
| Treat pull requests without CI checks as passing | Include pull requests from repositories without status checks in bulk merges. Off by default. |

## Limits

- Up to 300 open pull requests are loaded.
- Only repositories where you have write access can be merged; others are shown with a lock icon and skipped by bulk actions.
