import { NgClass } from '@angular/common'
import { AfterViewInit, Component, OnInit, booleanAttribute, inject, input, output } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { RestService } from '@app/core'
import { NgbDropdown, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap'
import debug from 'debug'
import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'

export type AdvancedInputFilter = {
  title: string

  children: AdvancedInputFilterChild[]
}

export type AdvancedInputFilterChild = {
  label: string
  value: string
}

const debugLogger = debug('peertube:AdvancedInputFilterComponent')

@Component({
  selector: 'my-advanced-input-filter',
  templateUrl: './advanced-input-filter.component.html',
  styleUrls: [ './advanced-input-filter.component.scss' ],
  imports: [ NgbDropdown, NgbDropdownToggle, NgbDropdownMenu, GlobalIconComponent, NgClass, FormsModule ]
})
export class AdvancedInputFilterComponent implements OnInit, AfterViewInit {
  private route = inject(ActivatedRoute)
  private restService = inject(RestService)
  private router = inject(Router)

  readonly filters = input<AdvancedInputFilter[]>([])
  readonly emitOnInit = input(false, { transform: booleanAttribute })
  readonly icon = input(false, { transform: booleanAttribute })
  readonly placeholder = input($localize`Filter...`)
  readonly inputId = input('table-filter')

  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly search = output<string>()

  searchValue: string

  private enabledFilters = new Set<string>()

  private searchStream: Subject<string>

  private viewInitialized = false
  private emitSearchAfterViewInit = false

  ngOnInit () {
    this.initSearchStream()
    this.listenToRouteSearchChange()
  }

  ngAfterViewInit () {
    this.viewInitialized = true

    // Init after view init to not send an event too early
    if (this.emitOnInit() && this.emitSearchAfterViewInit) this.emitSearch()
  }

  onInputSearch (event: Event) {
    this.scheduleSearchUpdate((event.target as HTMLInputElement).value)
  }

  onSearchClick () {
    this.scheduleSearchUpdate(this.searchValue)
  }

  onResetTableFilter () {
    this.immediateSearchUpdate('')
  }

  hasFilters () {
    const filters = this.filters()
    return filters && filters.length !== 0
  }

  isFilterEnabled (filter: AdvancedInputFilterChild) {
    return this.enabledFilters.has(filter.value)
  }

  onFilterClick (filter: AdvancedInputFilterChild) {
    const newSearch = this.isFilterEnabled(filter)
      ? this.removeFilterToSearch(this.searchValue, filter)
      : this.addFilterToSearch(this.searchValue, filter)

    this.setQueryParams(newSearch)
  }

  private scheduleSearchUpdate (value: string) {
    this.searchValue = value
    this.searchStream.next(this.searchValue)
  }

  private immediateSearchUpdate (value: string) {
    this.searchValue = value

    this.setQueryParams(this.searchValue)
    this.parseFilters(this.searchValue)
    this.emitSearch()
  }

  private listenToRouteSearchChange () {
    this.route.queryParams
      .subscribe(params => {
        const search = params.search || ''

        debugLogger('On route search change "%s".', search)

        if (this.searchValue === search) return

        this.searchValue = search

        this.parseFilters(this.searchValue)

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
        this.parseFilters(this.searchValue)

        this.emitSearch()
      })
  }

  private emitSearch () {
    if (!this.viewInitialized) {
      this.emitSearchAfterViewInit = true
      return
    }

    debugLogger('On search "%s".', this.searchValue)

    this.search.emit(this.searchValue)
  }

  private setQueryParams (search: string) {
    const searchParams = search
      ? { search: search.trim() }
      : { search: undefined }

    this.router.navigate([ '.' ], { relativeTo: this.route, queryParams: { ...this.route.snapshot.queryParams, ...searchParams } })
  }

  private removeFilterToSearch (search: string, removedFilter: AdvancedInputFilterChild) {
    return search.replace(removedFilter.value, '')
  }

  private addFilterToSearch (search: string, newFilter: AdvancedInputFilterChild) {
    const filterTokens = this.restService.tokenizeString(newFilter.value)

    const tokensToAdd: string[] = []
    let searchTokens = this.restService.tokenizeString(search)

    for (const filterToken of filterTokens) {
      const prefix = filterToken.split(':').shift()

      // Tokenize search and remove a potential existing filter
      searchTokens = searchTokens.filter(t => !t.startsWith(prefix))
      tokensToAdd.push(filterToken)
    }

    return searchTokens.concat(tokensToAdd).join(' ')
  }

  private parseFilters (search: string) {
    const searchTokens = this.restService.tokenizeString(search)

    this.enabledFilters = new Set()

    for (const group of this.filters()) {
      for (const filter of group.children) {
        const filterTokens = this.restService.tokenizeString(filter.value)

        if (filterTokens.every(filterToken => searchTokens.includes(filterToken))) {
          this.enabledFilters.add(filter.value)
        }
      }
    }
  }
}
