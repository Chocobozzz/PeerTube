import * as debug from 'debug'
import { LazyLoadEvent, SortMeta } from 'primeng/api'
import { ActivatedRoute, Router } from '@angular/router'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { RestPagination } from './rest-pagination'

const logger = debug('peertube:tables:RestTable')

export abstract class RestTable {

  abstract totalRecords: number
  abstract sort: SortMeta
  abstract pagination: RestPagination

  rowsPerPageOptions = [ 10, 20, 50, 100 ]
  rowsPerPage = this.rowsPerPageOptions[0]
  expandedRows = {}

  search: string

  protected route: ActivatedRoute
  protected router: Router

  abstract getIdentifier (): string

  initialize () {
    this.loadSort()
  }

  loadSort () {
    const result = peertubeLocalStorage.getItem(this.getSortLocalStorageKey())

    if (result) {
      try {
        this.sort = JSON.parse(result)
      } catch (err) {
        console.error('Cannot load sort of local storage key ' + this.getSortLocalStorageKey(), err)
      }
    }
  }

  loadLazy (event: LazyLoadEvent) {
    logger('Load lazy %o.', event)

    this.sort = {
      order: event.sortOrder,
      field: event.sortField
    }

    this.pagination = {
      start: event.first,
      count: this.rowsPerPage
    }

    this.reloadData()
    this.saveSort()
  }

  saveSort () {
    peertubeLocalStorage.setItem(this.getSortLocalStorageKey(), JSON.stringify(this.sort))
  }

  onPage (event: { first: number, rows: number }) {
    logger('On page %o.', event)

    if (this.rowsPerPage !== event.rows) {
      this.rowsPerPage = event.rows
      this.pagination = {
        start: event.first,
        count: this.rowsPerPage
      }

      this.reloadData()
    }

    this.expandedRows = {}
  }

  onSearch (search: string) {
    this.search = search
    this.reloadData()
  }

  protected abstract reloadData (): void

  private getSortLocalStorageKey () {
    return 'rest-table-sort-' + this.getIdentifier()
  }
}
