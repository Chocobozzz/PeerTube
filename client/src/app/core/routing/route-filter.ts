import * as debug from 'debug'
import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'
import { ActivatedRoute, Params, Router } from '@angular/router'

const logger = debug('peertube:tables:RouteFilter')

export abstract class RouteFilter {
  search: string

  protected searchStream: Subject<string>

  protected route: ActivatedRoute
  protected router: Router

  initSearch () {
    this.searchStream = new Subject()

    this.searchStream
      .pipe(
        debounceTime(200),
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

    this.setQueryParams(target.value)
  }

  resetTableFilter () {
    this.setTableFilter('')
    this.setQueryParams('')
    this.resetSearch()
  }

  resetSearch () {
    this.searchStream.next('')
    this.setTableFilter('')
  }

  listenToSearchChange () {
    this.route.queryParams
      .subscribe(params => {
        this.search = params.search || ''

        // Primeng table will run an event to load data
        this.setTableFilter(this.search)
      })
  }

  setTableFilter (filter: string, triggerEvent = true) {
    // FIXME: cannot use ViewChild, so create a component for the filter input
    const filterInput = document.getElementById('table-filter') as HTMLInputElement
    if (!filterInput) return

    filterInput.value = filter

    if (triggerEvent) filterInput.dispatchEvent(new Event('keyup'))
  }

  protected abstract loadData (): void

  private setQueryParams (search: string) {
    const queryParams: Params = {}

    if (search) Object.assign(queryParams, { search })
    this.router.navigate([ ], { queryParams })
  }
}
