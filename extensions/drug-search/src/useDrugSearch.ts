import { useFetch } from "@raycast/utils";
import { Root } from "./interfaces";

const API_URL = "https://api.fda.gov/drug/drugsfda.json";
const PAGE_SIZE = 25; // You can adjust this
const SEARCH_FIELDS = ["openfda.brand_name", "openfda.generic_name", "products.brand_name"];

/**
 * Builds an openFDA query that matches the term as a phrase in brand or generic names.
 * Quotes and backslashes are stripped so user input cannot break out of the phrase.
 */
function buildSearchQuery(search: string): string | undefined {
  const term = search.replace(/["\\]/g, " ").trim().replace(/\s+/g, " ");
  if (!term) {
    return undefined;
  }
  return SEARCH_FIELDS.map((field) => `${field}:"${term}"`).join(" ");
}

/**
 * Custom hook for searching the openFDA drug database with pagination.
 *
 * @param search - The search query.
 * @param sort - The field to sort by (e.g., "sponsor_name:asc"). Must be a non-analyzed field.
 *              Use non-analyzed fields like: sponsor_name, application_number
 *              Do NOT use analyzed fields like: openfda.brand_name
 */
export function useDrugSearch(search: string, sort?: string) {
  const { isLoading, data, error, pagination } = useFetch(
    (options) => {
      // This function is called by useFetch to get the URL for each page
      const params = new URLSearchParams();

      // Handle search
      const query = buildSearchQuery(search);
      if (query) {
        // URLSearchParams encodes spaces as "+", which openFDA treats as OR
        params.append("search", query);
      }

      // Handle sorting
      if (sort) {
        params.append("sort", sort);
      }

      // Handle pagination
      // The API uses `skip` and `limit`
      const skip = options.page * PAGE_SIZE;
      params.append("limit", String(PAGE_SIZE));
      params.append("skip", String(skip));

      const url = `${API_URL}?${params.toString()}`;
      return url;
    },
    {
      // openFDA responds with 404 NOT_FOUND when nothing matches; treat that as an empty result set
      async parseResponse(response): Promise<Root> {
        const json = await response.json().catch(() => undefined);
        if (response.status === 404 && json?.error?.code === "NOT_FOUND") {
          return { results: [], meta: { results: { skip: 0, limit: 0, total: 0 } } } as unknown as Root;
        }
        if (!response.ok) {
          throw new Error(json?.error?.message || response.statusText || `Request failed (${response.status})`);
        }
        return json as Root;
      },
      // Always fetch - either search results or all drugs by default
      // mapResult is used to transform the API response into the format useFetch expects
      // for pagination: { data: [], hasMore: boolean }
      mapResult(result: Root) {
        try {
          const total = result.meta.results.total;
          const skip = result.meta.results.skip;
          const limit = result.meta.results.limit;

          const hasMore = skip + limit < total;

          return {
            data: result.results, // The array of drug results
            hasMore: hasMore, // Boolean to indicate if more pages are available
          };
        } catch {
          return {
            data: [],
            hasMore: false,
          };
        }
      },
      onError() {
        // Handle errors silently
      },
      // Keep previous data while loading new search results to prevent flickering
      keepPreviousData: true,
      initialData: [], // Start with an empty array of results
    },
  );

  return {
    isLoading,
    data,
    error,
    pagination,
  };
}
