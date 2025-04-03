import { ActivatedRoute, Router } from '@angular/router'
import { logger } from '@root-helpers/logger'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import debug from 'debug'
import { SortMeta } from 'primeng/api'
import { TableLazyLoadEvent } from 'primeng/table'
import { RestPagination } from './rest-pagination'

const debugLogger = debug('peertube:tables:RestTable')

export abstract class RestTable<T = unknown> {
  abstract totalRecords: number
  abstract sort: SortMeta
  abstract pagination: RestPagination

  rowsPerPageOptions = [ 5, 10, 20, 50, 100 ]
  rowsPerPage = 10
  expandedRows = {}

  selectedRows: T[] = []

  search: string

  sortTooltip = $localize`Sort by this column`

  protected route: ActivatedRoute
  protected router: Router

  // First string is badge column type
  // Inner Map is value -> badge name
  private valueToBadge = new Map<string, Map<string, string>>()
  private badgesUsed = new Set<string>()

  private lastLazyLoadEvent: TableLazyLoadEvent

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
        logger.error('Cannot load sort of local storage key ' + this.getSortLocalStorageKey(), err)
      }
    }
  }

  saveSort () {
    peertubeLocalStorage.setItem(this.getSortLocalStorageKey(), JSON.stringify(this.sort))
  }

  protected parseLazy (event: TableLazyLoadEvent) {
    debugLogger('Load lazy %o.', event)

    if (this.lastLazyLoadEvent) {
      // Prevent lazy loading twice
      // TODO: remove when https://github.com/primefaces/primeng/issues/5480 is fixed
      if (
        this.lastLazyLoadEvent.first === event.first &&
        this.lastLazyLoadEvent.rows === event.rows &&
        this.lastLazyLoadEvent.sortField === event.sortField &&
        this.lastLazyLoadEvent.sortOrder === event.sortOrder
      ) return false
    }

    this.lastLazyLoadEvent = event

    this.sort = {
      order: event.sortOrder,
      field: event.sortField as string
    }

    this.rowsPerPage = event.rows

    this.pagination = {
      start: event.first,
      count: this.rowsPerPage
    }

    this.expandedRows = {}

    return true
  }

  loadLazy (event: TableLazyLoadEvent) {
    if (this.parseLazy(event)) {
      this.reloadData()
      this.saveSort()
    }
  }

  onSearch (search: string) {
    this.search = search

    this.resetPagination()
    this.reloadData()
  }

  resetPagination () {
    this.pagination = {
      start: 0,
      count: this.rowsPerPage
    }
  }

  isInSelectionMode () {
    return this.selectedRows.length !== 0
  }

  getPaginationTemplate () {
    return $localize`Showing {first} to {last} of {totalRecords} elements`
  }

  protected abstract reloadDataInternal (): void

  protected reloadData () {
    this.selectedRows = []

    this.reloadDataInternal()
  }

  protected getRandomBadge (type: string, value: string): string {
    if (!this.valueToBadge.has(type)) {
      this.valueToBadge.set(type, new Map())
    }

    const badges = this.valueToBadge.get(type)
    const badge = badges.get(value)
    if (badge) return badge

    const toTry = [
      'badge-yellow',
      'badge-purple',
      'badge-blue',
      'badge-brown',
      'badge-green',
      'badge-secondary'
    ]

    for (const badge of toTry) {
      if (!this.badgesUsed.has(badge)) {
        this.badgesUsed.add(badge)
        badges.set(value, badge)
        return badge
      }
    }

    // Reset, we used all available badges
    this.badgesUsed.clear()

    return this.getRandomBadge(type, value)
  }

  private getSortLocalStorageKey () {
    return 'rest-table-sort-' + this.getIdentifier()
  }
}
