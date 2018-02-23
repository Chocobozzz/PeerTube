import { LazyLoadEvent } from 'primeng/components/common/lazyloadevent'
import { SortMeta } from 'primeng/components/common/sortmeta'

import { RestPagination } from './rest-pagination'

export abstract class RestTable {

  abstract totalRecords: number
  abstract rowsPerPage: number
  abstract sort: SortMeta
  abstract pagination: RestPagination

  private sortLocalStorageKey = 'rest-table-sort-' + this.constructor.name

  protected abstract loadData (): void

  loadSort () {
    const result = localStorage.getItem(this.sortLocalStorageKey)

    if (result) {
      try {
        this.sort = JSON.parse(result)
      } catch (err) {
        console.error('Cannot load sort of local storage key ' + this.sortLocalStorageKey, err)
      }
    }
  }

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
    this.saveSort()
  }

  saveSort () {
    localStorage.setItem(this.sortLocalStorageKey, JSON.stringify(this.sort))
  }

}
