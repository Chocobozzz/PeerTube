export interface ComponentPagination {
  currentPage: number
  itemsPerPage: number
  totalItems: number
}

export type ComponentPaginationLight = Omit<ComponentPagination, 'totalItems'>

export function hasMoreItems (componentPagination: ComponentPagination) {
  // No results
  if (componentPagination.totalItems === 0) return false

  // Not loaded yet
  if (!componentPagination.totalItems) return true

  const maxPage = componentPagination.totalItems / componentPagination.itemsPerPage
  return maxPage > componentPagination.currentPage
}
