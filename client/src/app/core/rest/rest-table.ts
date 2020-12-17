import * as debug from 'debug'
import { LazyLoadEvent, SortMeta } from 'primeng/api'
import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'
import { ActivatedRoute, Params, Router } from '@angular/router'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { RestPagination } from './rest-pagination'

const logger = debug('peertube:tables:RestTable')

export abstract class RestTable {

  abstract totalRecords: number
  abstract sort: SortMeta
  abstract pagination: RestPagination

  search: string
  rowsPerPageOptions = [ 10, 20, 50, 100 ]
  rowsPerPage = this.rowsPerPageOptions[0]
  expandedRows = {}

  baseRoute: string

  protected searchStream: Subject<string>

  protected route: ActivatedRoute
  protected router: Router

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

    this.setQueryParams((event.target as HTMLInputElement).value)
  }

  setQueryParams (search: string) {
    if (!this.baseRoute) return

    const queryParams: Params = {}

    if (search) Object.assign(queryParams, { search })
    this.router.navigate([ this.baseRoute ], { queryParams })
  }

  resetTableFilter () {
    this.setTableFilter('')
    this.setQueryParams('')
    this.resetSearch()
  }

  listenToSearchChange () {
    this.route.queryParams
      .subscribe(params => {
        this.search = params.search || ''

        // Primeng table will run an event to load data
        this.setTableFilter(this.search)
      })
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

  setTableFilter (filter: string, triggerEvent = true) {
    // FIXME: cannot use ViewChild, so create a component for the filter input
    const filterInput = document.getElementById('table-filter') as HTMLInputElement
    if (!filterInput) return

    filterInput.value = filter

    if (triggerEvent) filterInput.dispatchEvent(new Event('keyup'))
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
