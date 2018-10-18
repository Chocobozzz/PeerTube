import { peertubeLocalStorage } from '@app/shared/misc/peertube-local-storage'
import { LazyLoadEvent } from 'primeng/components/common/lazyloadevent'
import { SortMeta } from 'primeng/components/common/sortmeta'
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

  onSearch (search: string) {
    this.searchStream.next(search)
  }

  protected abstract loadData (): void
}
