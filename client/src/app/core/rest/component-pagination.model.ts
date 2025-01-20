export interface ComponentPagination {
  currentPage: number
  itemsPerPage: number
  totalItems: number
  itemsRemoved?: number
}

export type ComponentPaginationLight = Omit<ComponentPagination, 'totalItems'> & { totalItems?: number }

export function hasMoreItems (componentPagination: ComponentPaginationLight) {
  // No results
  if (componentPagination.totalItems === 0) return false

  // Not loaded yet
  if (!componentPagination.totalItems) return true

  const maxPage = componentPagination.totalItems / componentPagination.itemsPerPage
  return maxPage > componentPagination.currentPage
}

export function updatePaginationOnDelete (componentPagination: ComponentPagination, itemsDeleted = 1) {
  componentPagination.totalItems -= itemsDeleted

  if (!componentPagination.itemsRemoved) componentPagination.itemsRemoved = 0

  componentPagination.itemsRemoved += itemsDeleted
}

export function resetCurrentPage (componentPagination: ComponentPaginationLight) {
  componentPagination.currentPage = 1
  componentPagination.itemsRemoved = 0
}
