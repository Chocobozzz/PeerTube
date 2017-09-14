import { LazyLoadEvent, SortMeta } from 'primeng/primeng'

import { RestPagination } from './rest-pagination'

export abstract class RestTable {
  abstract totalRecords: number
  abstract rowsPerPage: number
  abstract sort: SortMeta
  abstract pagination: RestPagination

  protected abstract loadData (): void

  loadLazy (event: LazyLoadEvent) {
    this.sort = {
      order: event.sortOrder,
      field: event.sortField
    }

    this.pagination = {
      start: event.first,
      count: this.rowsPerPage
    }

    this.loadData()
  }

}
