import { commonStrings } from "../constants/common.js";
import { AppError } from "../utils/app-error.js";

const GITHUB_SEARCH_URL = "https://api.github.com/search/repositories";

const SEARCH_CACHE_TTL_MS = 300_000;

const MAX_CACHE_ENTRIES = 100;

export interface ExploreRepositoryQuery {
  query: string;
  language?: string;
  sort: "stars" | "updated";
  page: number;
}

interface GitHubSearchItem {
  full_name?: string;
  html_url?: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  updated_at?: string;
}

interface GitHubSearchResponse {
  total_count?: number;
  items?: GitHubSearchItem[];
}

interface CachedSearch {
  expiresAt: number;
  value: ExploreRepositoryResults;
}

export interface ExploreRepositoryResults {
  total_count: number;
  page: number;
  per_page: number;
  repositories: {
    full_name: string;
    html_url: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    updated_at: string;
  }[];
}

export const createExploreService = (request: typeof fetch = fetch) => {
  const cache = new Map<string, CachedSearch>();

  const searchPublicRepositories = async (
    input: ExploreRepositoryQuery,
  ): Promise<ExploreRepositoryResults> => {
    const cacheKey = JSON.stringify(input);

    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    if (cached) cache.delete(cacheKey);

    const searchTerms = [input.query.trim(), "is:public"];
    if (input.language) searchTerms.push(`language:${input.language}`);

    const url = new URL(GITHUB_SEARCH_URL);
    url.searchParams.set("q", searchTerms.join(" "));
    url.searchParams.set("sort", input.sort);
    url.searchParams.set("order", "desc");
    url.searchParams.set("per_page", "10");
    url.searchParams.set("page", String(input.page));

    let response: Response;
    try {
      response = await request(url, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "AI-Codebase-Assistant",
        },
        redirect: "error",
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new AppError(
        "GITHUB_SEARCH_UNAVAILABLE",
        commonStrings.GITHUB_SEARCH_UNAVAILABLE,
        503,
      );
    }

    if (response.status === 403 || response.status === 429)
      throw new AppError(
        "GITHUB_SEARCH_RATE_LIMITED",
        commonStrings.GITHUB_SEARCH_RATE_LIMITED,
        503,
      );
    if (!response.ok)
      throw new AppError(
        "GITHUB_SEARCH_UNAVAILABLE",
        commonStrings.GITHUB_SEARCH_UNAVAILABLE,
        response.status >= 500 ? 503 : 400,
      );

    let data: GitHubSearchResponse;
    try {
      data = (await response.json()) as GitHubSearchResponse;
    } catch {
      throw new AppError(
        "GITHUB_SEARCH_UNAVAILABLE",
        commonStrings.GITHUB_SEARCH_UNAVAILABLE,
        503,
      );
    }

    const repositories = (data.items ?? []).slice(0, 10).flatMap((item) => {
      if (
        !item.full_name ||
        item.full_name.length > 255 ||
        !/^[\w.-]+\/[\w.-]+$/.test(item.full_name)
      )
        return [];
      const repositoryUrl = `https://github.com/${item.full_name}`;
      if (item.html_url !== repositoryUrl) return [];
      return [{
        full_name: item.full_name,
        html_url: repositoryUrl,
        description: item.description?.slice(0, 400) ?? null,
        language: item.language?.slice(0, 50) ?? null,
        stargazers_count: item.stargazers_count ?? 0,
        forks_count: item.forks_count ?? 0,
        updated_at: item.updated_at ?? "",
      }];
    });

    const result = {
      total_count: data.total_count ?? repositories.length,
      page: input.page,
      per_page: 10,
      repositories,
    };

    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(cacheKey, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, value: result });
    return result;
  };

  return { searchPublicRepositories };
};
