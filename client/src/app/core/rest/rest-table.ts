import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { LazyLoadEvent, SortMeta } from 'primeng/api'
import { RestPagination } from './rest-pagination'
import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'
import * as debug from 'debug'

const logger = debug('peertube:tables:RestTable')

export abstract class RestTable {

  abstract totalRecords: number
  abstract sort: SortMeta
  abstract pagination: RestPagination

  search: string
  rowsPerPageOptions = [ 10, 20, 50, 100 ]
  rowsPerPage = this.rowsPerPageOptions[0]
  expandedRows = {}

  protected searchStream: Subject<string>

  abstract getIdentifier (): string

  initialize () {
    this.loadSort()
    this.initSearch()
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

    this.loadData()
    this.saveSort()
  }

  saveSort () {
    peertubeLocalStorage.setItem(this.getSortLocalStorageKey(), JSON.stringify(this.sort))
  }

  initSearch () {
    this.searchStream = new Subject()

    this.searchStream
      .pipe(
        debounceTime(400),
        distinctUntilChanged()
      )
      .subscribe(search => {
        this.search = search

        logger('On search %s.', this.search)

        this.loadData()
      })
  }

  onSearch (event: Event) {
    const target = event.target as HTMLInputElement
    this.searchStream.next(target.value)
  }

  onPage (event: { first: number, rows: number }) {
    logger('On page %o.', event)

    if (this.rowsPerPage !== event.rows) {
      this.rowsPerPage = event.rows
      this.pagination = {
        start: event.first,
        count: this.rowsPerPage
      }

      this.loadData()
    }

    this.expandedRows = {}
  }

  setTableFilter (filter: string) {
    // FIXME: cannot use ViewChild, so create a component for the filter input
    const filterInput = document.getElementById('table-filter') as HTMLInputElement
    if (filterInput) filterInput.value = filter
  }

  resetSearch () {
    this.searchStream.next('')
    this.setTableFilter('')
  }

  protected abstract loadData (): void

  private getSortLocalStorageKey () {
    return 'rest-table-sort-' + this.getIdentifier()
  }
}
