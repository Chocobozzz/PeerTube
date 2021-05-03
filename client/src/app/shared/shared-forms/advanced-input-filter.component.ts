import * as debug from 'debug'
import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
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
export class AdvancedInputFilterComponent implements OnInit {
  @Input() filters: AdvancedInputFilter[] = []

  @Output() search = new EventEmitter<string>()

  searchValue: string

  private searchStream: Subject<string>

  constructor (
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit () {
    this.initSearchStream()
    this.listenToRouteSearchChange()
  }

  onInputSearch (event: Event) {
    this.updateSearch((event.target as HTMLInputElement).value)
  }

  onResetTableFilter () {
    this.updateSearch('')
  }

  hasFilters () {
    return this.filters.length !== 0
  }

  private updateSearch (value: string) {
    this.searchValue = value
    this.searchStream.next(this.searchValue)
  }

  private listenToRouteSearchChange () {
    this.route.queryParams
      .subscribe(params => {
        const search = params.search || ''

        logger('On route search change "%s".', search)

        this.updateSearch(search)
      })
  }

  private initSearchStream () {
    this.searchStream = new Subject()

    this.searchStream
      .pipe(
        debounceTime(200),
        distinctUntilChanged()
      )
      .subscribe(() => {
        logger('On search "%s".', this.searchValue)

        this.setQueryParams(this.searchValue)
        this.search.emit(this.searchValue)
      })
  }

  private setQueryParams (search: string) {
    const queryParams: Params = {}

    if (search) Object.assign(queryParams, { search })
    this.router.navigate([ ], { queryParams })
  }
}
