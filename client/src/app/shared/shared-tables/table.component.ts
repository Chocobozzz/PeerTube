import { CommonModule } from '@angular/common'
import {
  booleanAttribute,
  Component,
  ContentChild,
  inject,
  input,
  numberAttribute,
  OnChanges,
  OnDestroy,
  OnInit,
  output,
  SimpleChanges,
  TemplateRef,
  viewChild
} from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { LocalStorageService, Notifier, PeerTubeRouterService, RestPagination, ScreenService } from '@app/core'
import { NgbDropdownModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'
import { ResultList } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import debug from 'debug'
import { SharedModule, SortMeta } from 'primeng/api'
import { TableLazyLoadEvent, TableModule, TableRowExpandEvent, TableRowReorderEvent } from 'primeng/table'
import { finalize, Observable, Subscription } from 'rxjs'
import {
  AdvancedFilterDef,
  AdvancedInputFilterComponent,
  parseQueryParamsToAdvancedFilters
} from '../shared-forms/advanced-input-filter.component'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { SearchInputComponent } from '../shared-forms/search-input.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { ActionDropdownComponent, DropdownAction } from '../shared-main/buttons/action-dropdown.component'
import { ButtonComponent } from '../shared-main/buttons/button.component'
import { AutoColspanDirective } from '../shared-main/common/auto-colspan.directive'
import { TableExpanderIconComponent } from './table-expander-icon.component'

const debugLogger = debug('peertube:table')

export type DataLoaderOptionsBase = {
  pagination: RestPagination
  sort: SortMeta
  search?: string
}
export type DataLoader<DataLoaderOptions extends DataLoaderOptionsBase, Data> = (options: DataLoaderOptions) => Observable<ResultList<Data>>

export type TableQueryParams = {
  start?: number
  count?: number
  sortOrder?: number
  sortField?: string
  search?: string

  state?: number
}

export type TableColumnInfo<ColumnName> = {
  id: ColumnName

  label: string
  labelSmall?: string

  sortable: boolean

  class?: string
  selected?: boolean // true by default
  sortKey?: string // same as id by default
  isDisplayed?: () => boolean // true by default
}

type BulkActions<Data> = DropdownAction<Data[]>[][] | DropdownAction<Data[]>[]

@Component({
  selector: 'my-table',
  templateUrl: './table.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    SharedModule,
    ActionDropdownComponent,
    ButtonComponent,
    NgbTooltipModule,
    NgbDropdownModule,
    PeertubeCheckboxComponent,
    AutoColspanDirective,
    TableExpanderIconComponent,
    GlobalIconComponent,
    SearchInputComponent,
    AdvancedInputFilterComponent
  ]
})
export class TableComponent<
  Data,
  DataLoaderOptions extends DataLoaderOptionsBase = DataLoaderOptionsBase,
  ColumnName = string,
  QueryParams extends TableQueryParams = TableQueryParams
> implements OnInit, OnDestroy, OnChanges {
  private peertubeLocalStorage = inject(LocalStorageService)
  private route = inject(ActivatedRoute)
  private peertubeRouter = inject(PeerTubeRouterService)
  private notifier = inject(Notifier)
  private screenService = inject(ScreenService)

  private advancedInputFilter = viewChild<AdvancedInputFilterComponent<DataLoaderOptions>>('advancedInputFilter')

  readonly key = input.required<string>()
  readonly dataKey = input<string>('id')
  readonly defaultColumns = input.required<TableColumnInfo<ColumnName>[]>()
  readonly dataLoader = input.required<DataLoader<DataLoaderOptionsBase, Data>>()

  readonly reorderableRows = input(false, { transform: booleanAttribute })
  readonly dragHandleTitle = input<string>(undefined)

  readonly defaultSort = input<string>('createdAt')
  readonly defaultSortOrder = input<'asc' | 'desc'>('desc')

  readonly defaultRowsPerPage = input(10, { transform: numberAttribute })
  readonly columnConfig = input(true, { transform: booleanAttribute })
  readonly hasExpandedRow = input<(item: Data) => boolean>(() => true)

  readonly paginatorText = input.required<string>()
  readonly expandedIconTooltip = input($localize`More information`)

  readonly bulkActions = input<BulkActions<Data>>()

  readonly customParseQueryParams = input<(queryParams: QueryParams) => void>(() => {})
  readonly customUpdateUrl = input<() => Partial<QueryParams>>(() => ({}))

  readonly cellWrap = input(false, { transform: booleanAttribute })

  readonly searchInput = input(false, { transform: booleanAttribute })
  readonly canUseMatchSort = input(false, { transform: booleanAttribute })

  readonly refreshButton = input(false, { transform: booleanAttribute })

  readonly inputFilters = input<AdvancedFilterDef<DataLoaderOptions>[]>()
  readonly defaultInputFilterValues = input<Partial<DataLoaderOptions>>()

  private inputFilterValues: Partial<DataLoaderOptions> = {}

  private loadDataSub: Subscription

  @ContentChild('totalTitle', { descendants: false })
  totalTitle: TemplateRef<any>

  @ContentChild('captionRight', { descendants: false })
  captionRight: TemplateRef<any>

  @ContentChild('captionLeft', { descendants: false })
  captionLeft: TemplateRef<any>

  @ContentChild('tableCells', { descendants: false })
  tableCells: TemplateRef<any>

  @ContentChild('actionCell', { descendants: false })
  actionCell: TemplateRef<any>

  @ContentChild('noResults', { descendants: false })
  noResults: TemplateRef<any>

  @ContentChild('expandedRow', { descendants: false })
  expandedRow: TemplateRef<any>

  readonly rowExpand = output<TableRowExpandEvent>()
  readonly rowReorder = output<TableRowReorderEvent>()
  readonly filtersChange = output<Partial<DataLoaderOptions>>()
  readonly searchChange = output<string>()

  selectedRows: Data[] = []
  expandedRows = {}
  data: Data[] = []
  columns: Required<TableColumnInfo<ColumnName>>[] = []

  totalRecords = 0
  rowsPerPageOptions = [ 5, 10, 20, 50, 100 ]

  sort: SortMeta = { field: undefined, order: -1 }
  saveSort: SortMeta

  pagination: RestPagination

  search: string

  loaded = false
  loading = false

  sortTooltip = $localize`Sort by this column`

  private lastLazyLoadEvent: TableLazyLoadEvent
  private routeSubscription: Subscription

  ngOnInit (): void {
    this.setDefaultSort()

    this.pagination = {
      count: this.defaultRowsPerPage(),
      start: 0
    }

    this.loadTableSettings()
    this.loadSelectedColumns()
    this.subscribeToQueryChanges()
  }

  ngOnDestroy () {
    this.routeSubscription?.unsubscribe()

    if (this.loadDataSub?.closed === false) {
      this.loadDataSub.unsubscribe()
    }
  }

  ngOnChanges (changes: SimpleChanges) {
    if (changes['defaultColumns']) {
      this.columns = this.defaultColumns().map(c => ({
        id: c.id,

        label: c.label,
        labelSmall: c.labelSmall,
        sortable: c.sortable,

        class: c.class || '',
        selected: c.selected ?? true,
        sortKey: c.sortKey || c.id as string,
        isDisplayed: c.isDisplayed || (() => true)
      }))
    }
  }

  // ---------------------------------------------------------------------------

  getColumn (id: ColumnName) {
    return this.columns.find(c => c.id === id)
  }

  getUntypedColumnId (column: { id: ColumnName }) {
    return column.id as string
  }

  isColumnDisplayed (name: ColumnName) {
    const column = this.getColumn(name)
    if (column.selected === false) return false

    return column.isDisplayed()
  }

  // ---------------------------------------------------------------------------

  onSearch (search: string) {
    debugLogger('On search', { search, canUseMatchSort: this.canUseMatchSort() })

    this.search = search

    if (this.search) {
      if (this.canUseMatchSort() && this.sort.field !== 'match') {
        debugLogger('Saving previous sort on search', { saveSort: this.sort })

        this.saveSort = { ...this.sort }

        this.sort = { field: 'match', order: -1 }
      }
    } else if (this.sort.field === 'match') {
      if (this.saveSort) {
        this.sort = { ...this.saveSort }
        this.saveSort = undefined
      } else {
        this.setDefaultSort()
      }
    }

    this.searchChange.emit(this.search)

    this.resetPagination()
    this.updateUrl()
  }

  onFiltersChange (filters: Partial<DataLoaderOptions> = {}) {
    debugLogger('On filter', filters)

    this.loadFilters(filters)

    this.filtersChange.emit(filters)

    this.resetPagination()
    this.updateUrl()
  }

  // Remove default options from filters
  private loadFilters (filters: Partial<DataLoaderOptions> = {}) {
    this.inputFilterValues = {}

    for (const [ key, value ] of Object.entries(filters)) {
      ;(this.inputFilterValues as any)[key] = value !== undefined && value !== 'all'
        ? value
        : undefined
    }
  }

  reloadData (sort?: SortMeta) {
    debugLogger('Reload data', sort)

    if (sort) this.sort = sort

    this.resetPagination()
    this.updateUrl({ reset: true })
  }

  private resetPagination () {
    this.pagination.start = 0

    this.selectedRows = []
    this.expandedRows = {}
  }

  private setDefaultSort () {
    this.sort = {
      field: this.defaultSort(),
      order: this.defaultSortOrder() === 'desc'
        ? -1
        : 1
    }
  }

  // ---------------------------------------------------------------------------

  saveSelectedColumns () {
    const enabled = this.columns.filter(c => c.selected !== false).map(c => c.id)

    this.peertubeLocalStorage.setItem(this.getColumnLocalStorageKey(), JSON.stringify(enabled))
  }

  private loadSelectedColumns () {
    const enabledString = this.peertubeLocalStorage.getItem(this.getColumnLocalStorageKey())

    if (!enabledString) return
    try {
      const enabled = JSON.parse(enabledString)

      for (const column of this.columns) {
        column.selected = enabled.includes(column.id)
      }
    } catch (err) {
      logger.error('Cannot load selected columns.', err)
    }
  }

  private getColumnLocalStorageKey () {
    return 'rest-table-columns-' + this.key()
  }

  // ---------------------------------------------------------------------------

  private loadTableSettings () {
    try {
      const sort = peertubeLocalStorage.getItem(this.getSortLocalStorageKey())
      if (sort) this.sort = JSON.parse(sort)

      const count = peertubeLocalStorage.getItem(this.getCountLocalStorageKey())
      if (count) this.pagination.count = JSON.parse(count)
    } catch (err) {
      logger.error('Cannot load sort of local storage key ' + this.getSortLocalStorageKey(), err)
    }
  }

  private saveTableSettings () {
    if (this.sort.field !== 'match') {
      peertubeLocalStorage.setItem(this.getSortLocalStorageKey(), JSON.stringify(this.sort))
    }

    peertubeLocalStorage.setItem(this.getCountLocalStorageKey(), JSON.stringify(this.pagination.count))
  }

  private getSortLocalStorageKey () {
    return 'rest-table-sort-' + this.key()
  }

  private getCountLocalStorageKey () {
    return 'rest-table-count-' + this.key()
  }

  // ---------------------------------------------------------------------------

  onLoadLazy (event: TableLazyLoadEvent) {
    if (this.parseLazy(event)) {
      debugLogger('Load lazy', event)

      this.saveTableSettings()

      this.updateUrl()
    }
  }

  private parseLazy (event: TableLazyLoadEvent) {
    debugLogger('Parse lazy', event)

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

    this.pagination = {
      start: event.first,
      count: event.rows
    }

    this.expandedRows = {}
    this.selectedRows = []

    return true
  }

  private subscribeToQueryChanges () {
    this.routeSubscription = this.route.queryParams.subscribe(queryParams => {
      this.parseQueryParams(queryParams as QueryParams)
    })
  }

  private parseQueryParams (queryParams: QueryParams) {
    debugLogger('Parse query params', { queryParams })

    if (queryParams.search !== undefined) this.search = queryParams.search
    if (queryParams.start !== undefined) this.pagination.start = +queryParams.start
    if (queryParams.count !== undefined) this.pagination.count = +queryParams.count
    if (queryParams.sortOrder !== undefined) this.sort.order = +queryParams.sortOrder
    if (queryParams.sortField !== undefined) this.sort.field = queryParams.sortField

    if (this.inputFilters()) {
      this.loadFilters(parseQueryParamsToAdvancedFilters(this.inputFilters(), this.route.snapshot.queryParams))
    }

    this.customParseQueryParams()(queryParams)

    this.loadData()
  }

  private updateUrl (options: {
    reset?: boolean
  } = {}) {
    const { reset = false } = options

    const newParams: TableQueryParams = {
      ...this.route.snapshot.queryParams,
      ...this.customUpdateUrl()(),

      ...this.inputFilterValues,

      search: this.search,
      start: this.pagination.start,
      count: this.pagination.count,
      sortOrder: this.sort.order,
      sortField: this.sort.field
    }

    if (reset) {
      const baseState = this.route.snapshot.queryParams.state || 0

      newParams.state = +baseState + 1
    }

    debugLogger('Update URL', { newParams })

    this.peertubeRouter.silentNavigate([ '.' ], newParams, this.route)
  }

  // ---------------------------------------------------------------------------

  isInSelectionMode () {
    return this.selectedRows.length !== 0
  }

  inInTouchScreen () {
    return this.screenService.isInTouchScreen()
  }

  getPaginationTemplate () {
    const start = this.pagination.start + 1
    const end = Math.min(this.pagination.start + this.pagination.count, this.totalRecords)

    return $localize`Showing ${start} to ${end} of ${this.totalRecords} elements`
  }

  hasBulkActions () {
    return this.bulkActions() && this.bulkActions().length !== 0
  }

  loadData (options: {
    skipLoader?: boolean // default false
  } = {}) {
    const { skipLoader = false } = options

    if (this.loadDataSub?.closed === false) {
      this.loadDataSub.unsubscribe()
    }

    if (!skipLoader) this.loading = true

    this.selectedRows = []

    return new Promise<void>((res, rej) => {
      this.loadDataSub = this.dataLoader()({
        ...this.inputFilterValues,

        pagination: this.pagination,
        sort: this.sort,
        search: this.search
      }).pipe(finalize(() => this.loading = false))
        .subscribe({
          next: resultList => {
            this.data = resultList.data
            this.totalRecords = resultList.total
            this.loaded = true

            res()
          },

          error: err => {
            this.notifier.handleError(err)
            rej(err)
          }
        })
    })
  }

  hasFilters () {
    const active = this.advancedInputFilter()?.activeCount() || 0

    return active !== 0
  }
}
