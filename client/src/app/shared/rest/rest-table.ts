import { peertubeLocalStorage } from '@app/shared/misc/peertube-web-storage'
import { LazyLoadEvent, SortMeta } from 'primeng/api'
import { RestPagination } from './rest-pagination'
import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'

export abstract class RestTable {

  abstract totalRecords: number
  abstract rowsPerPage: number
  abstract sort: SortMeta
  abstract pagination: RestPagination

  protected search: string
  private searchStream: Subject<string>
  private sortLocalStorageKey = 'rest-table-sort-' + this.constructor.name

  initialize () {
    this.loadSort()
    this.initSearch()
  }

  loadSort () {
    const result = peertubeLocalStorage.getItem(this.sortLocalStorageKey)

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
    peertubeLocalStorage.setItem(this.sortLocalStorageKey, JSON.stringify(this.sort))
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
        this.loadData()
      })
  }

  onSearch (event: Event) {
    const target = event.target as HTMLInputElement
    this.searchStream.next(target.value)
  }

  protected abstract loadData (): void
}
