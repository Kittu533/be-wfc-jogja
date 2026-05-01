import { getQueryString } from "./query";

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMeta extends PaginationParams {
  total: number;
  totalPages: number;
}

export function getPagination(
  query: Record<string, unknown>,
  defaultLimit = 12,
  maxLimit = 50,
): PaginationParams {
  return {
    page: parseBoundedInteger(getQueryString(query, "page"), 1, 1, 9999),
    limit: parseBoundedInteger(getQueryString(query, "limit"), defaultLimit, 1, maxLimit),
  };
}

export function paginateItems<T>(
  allItems: T[],
  page: number,
  limit: number,
): { items: T[]; meta: PaginationMeta } {
  const total = allItems.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * limit;

  return {
    items: allItems.slice(start, start + limit),
    meta: {
      page: safePage,
      limit,
      total,
      totalPages,
    },
  };
}

function parseBoundedInteger(
  rawValue: string,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed) || parsed < min) {
    return fallback;
  }

  return Math.min(parsed, max);
}
