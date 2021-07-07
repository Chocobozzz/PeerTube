import * as debug from 'debug'
import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'
import { AfterViewInit, Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { ActivatedRoute, Params, Router } from '@angular/router'

export type AdvancedInputFilter = {
  label: string
  queryParams: Params
}

const logger = debug('peertube:AdvancedInputFilterComponent')

@Component({
  selector: 'my-advanced-input-filter',
  templateUrl: './advanced-input-filter.component.html',
  styleUrls: [ './advanced-input-filter.component.scss' ]
})
export class AdvancedInputFilterComponent implements OnInit, AfterViewInit {
  @Input() filters: AdvancedInputFilter[] = []

  @Output() search = new EventEmitter<string>()

  searchValue: string

  private searchStream: Subject<string>

  private viewInitialized = false
  private emitSearchAfterViewInit = false

  constructor (
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit () {
    this.initSearchStream()
    this.listenToRouteSearchChange()
  }

  ngAfterViewInit () {
    this.viewInitialized = true

    // Init after view init to not send an event too early
    if (this.emitSearchAfterViewInit) this.emitSearch()
  }

  onInputSearch (event: Event) {
    this.scheduleSearchUpdate((event.target as HTMLInputElement).value)
  }

  onResetTableFilter () {
    this.immediateSearchUpdate('')
  }

  hasFilters () {
    return this.filters.length !== 0
  }

  private scheduleSearchUpdate (value: string) {
    this.searchValue = value
    this.searchStream.next(this.searchValue)
  }

  private immediateSearchUpdate (value: string) {
    this.searchValue = value

    this.setQueryParams(this.searchValue)
    this.emitSearch()
  }

  private listenToRouteSearchChange () {
    this.route.queryParams
      .subscribe(params => {
        const search = params.search || ''

        logger('On route search change "%s".', search)

        this.searchValue = search
        this.emitSearch()
      })
  }

  private initSearchStream () {
    this.searchStream = new Subject()

    this.searchStream
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.setQueryParams(this.searchValue)

        this.emitSearch()
      })
  }

  private emitSearch () {
    if (!this.viewInitialized) {
      this.emitSearchAfterViewInit = true
      return
    }

    logger('On search "%s".', this.searchValue)

    this.search.emit(this.searchValue)
  }

  private setQueryParams (search: string) {
    const queryParams: Params = {}

    if (search) Object.assign(queryParams, { search })
    this.router.navigate([ ], { queryParams })
  }
}
