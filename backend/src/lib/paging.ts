export type PageQuery = { page?: number; limit?: number; pageSize?: number };

export function pageWindow(query: PageQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? query.limit ?? 20));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function pageResult<T>(items: T[], totalCount: number, page: number, pageSize: number) {
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);
  return {
    items,
    page,
    pageSize,
    limit: pageSize,
    totalCount,
    total: totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalCount > 0,
  };
}
