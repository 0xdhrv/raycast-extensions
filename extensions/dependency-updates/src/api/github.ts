import { getPreferenceValues } from "@raycast/api";
import { OAuthService, withAccessToken } from "@raycast/utils";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

const preferences = getPreferenceValues<Preferences>();

let authorization: string | null = null;

export const githubOAuthService = OAuthService.github({
  scope: "repo read:org",
  personalAccessToken: preferences.personalAccessToken || undefined,
  onAuthorize({ token, type }) {
    authorization = type === "personal" ? `token ${token}` : `bearer ${token}`;
  },
});

export const withGitHubAuth = withAccessToken(githubOAuthService);

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string; type?: string; path?: (string | number)[] }[];
};

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly partialData?: unknown,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export async function graphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  options: { allowPartialData?: boolean } = {},
): Promise<T> {
  if (!authorization) {
    throw new Error("Not authorized with GitHub");
  }

  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
      "user-agent": "raycast-dependency-updates",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new GitHubError(`GitHub API error ${response.status}: ${text.slice(0, 200)}`);
  }

  const json = (await response.json()) as GraphQLResponse<T>;
  if (json.errors?.length && !(options.allowPartialData && json.data)) {
    throw new GitHubError(json.errors.map((e) => e.message).join("\n"), json.data);
  }
  if (!json.data) {
    throw new GitHubError("GitHub returned an empty response");
  }
  return json.data;
}
