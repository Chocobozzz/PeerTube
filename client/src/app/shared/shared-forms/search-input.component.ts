import { NgClass } from '@angular/common'
import { AfterViewInit, Component, OnInit, booleanAttribute, inject, input, output } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import debug from 'debug'
import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'

const debugLogger = debug('peertube:SearchInputComponent')

/**
 * Simple debounced text-search input with optional icon, clear button and `?search=` URL param sync.
 * Use this component when you need text search only, without structured filter controls.
 * For structured filters (options, checkboxes, select) use `my-advanced-input-filter` instead.
 */
@Component({
  selector: 'my-search-input',
  templateUrl: './search-input.component.html',
  styleUrls: [ './search-input.component.scss' ],
  imports: [ NgClass, FormsModule, GlobalIconComponent ]
})
export class SearchInputComponent implements OnInit, AfterViewInit {
  private route = inject(ActivatedRoute)
  private router = inject(Router)

  readonly placeholder = input($localize`Filter...`)
  readonly inputId = input('search-input')
  readonly icon = input(false, { transform: booleanAttribute })
  readonly emitOnInit = input(false, { transform: booleanAttribute })

  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly search = output<string>()

  searchValue = ''

  private searchStream: Subject<string>
  private viewInitialized = false
  private emitSearchAfterViewInit = false

  ngOnInit () {
    this.initSearchStream()
    this.listenToRouteSearchChange()
  }

  ngAfterViewInit () {
    this.viewInitialized = true

    if (this.emitOnInit() && this.emitSearchAfterViewInit) this.emitSearch()
  }

  onInputSearch (event: Event) {
    this.scheduleSearchUpdate((event.target as HTMLInputElement).value)
  }

  onSearchClick () {
    this.scheduleSearchUpdate(this.searchValue)
  }

  onClear () {
    this.immediateSearchUpdate('')
  }

  private scheduleSearchUpdate (value: string) {
    this.searchValue = value
    this.searchStream.next(this.searchValue)
  }

  private immediateSearchUpdate (value: string) {
    this.searchValue = value
    this.setQueryParam(this.searchValue)
    this.emitSearch()
  }

  private listenToRouteSearchChange () {
    this.route.queryParams
      .subscribe(params => {
        const search = params['search'] || ''

        debugLogger('On route search change "%s".', search)

        if (this.searchValue === search) return

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
        this.setQueryParam(this.searchValue)
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

  private setQueryParam (search: string) {
    const searchParams = search
      ? { search: search.trim() }
      : { search: undefined }

    this.router.navigate([ '.' ], {
      relativeTo: this.route,
      queryParams: { ...this.route.snapshot.queryParams, ...searchParams }
    })
  }
}
