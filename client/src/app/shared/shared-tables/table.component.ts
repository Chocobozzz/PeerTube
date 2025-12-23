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
  TemplateRef
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
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { ActionDropdownComponent, DropdownAction } from '../shared-main/buttons/action-dropdown.component'
import { ButtonComponent } from '../shared-main/buttons/button.component'
import { AutoColspanDirective } from '../shared-main/common/auto-colspan.directive'
import { TableExpanderIconComponent } from './table-expander-icon.component'

const debugLogger = debug('peertube:table')

export type DataLoaderOptions = {
  pagination: RestPagination
  sort: SortMeta
  search?: string
}
export type DataLoader<Data> = (options: DataLoaderOptions) => Observable<ResultList<Data>>

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
    GlobalIconComponent
  ]
})
export class TableComponent<Data, ColumnName = string, QueryParams extends TableQueryParams = TableQueryParams>
  implements OnInit, OnDestroy, OnChanges
{
  private peertubeLocalStorage = inject(LocalStorageService)
  private route = inject(ActivatedRoute)
  private peertubeRouter = inject(PeerTubeRouterService)
  private notifier = inject(Notifier)
  private screenService = inject(ScreenService)

  readonly key = input.required<string>()
  readonly dataKey = input<string>('id')
  readonly defaultColumns = input.required<TableColumnInfo<ColumnName>[]>()
  readonly dataLoader = input.required<DataLoader<Data>>()

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

  selectedRows: Data[] = []
  expandedRows = {}
  data: Data[] = []
  columns: Required<TableColumnInfo<ColumnName>>[] = []

  totalRecords = 0
  rowsPerPageOptions = [ 5, 10, 20, 50, 100 ]
  sort: SortMeta = { field: undefined, order: -1 }
  pagination: RestPagination

  search: string

  loaded = false
  loading = false

  sortTooltip = $localize`Sort by this column`

  // First string is badge column type
  // Inner Map is value -> badge name
  private valueToBadge = new Map<string, Map<string, string>>()
  private badgesUsed = new Set<string>()

  private lastLazyLoadEvent: TableLazyLoadEvent
  private routeSubscription: Subscription

  ngOnInit (): void {
    this.sort = {
      field: this.defaultSort(),
      order: this.defaultSortOrder() === 'desc'
        ? -1
        : 1
    }

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

  onSearch (search: string, useMatchSort = false) {
    debugLogger('On search', { search, useMatchSort })

    this.search = search

    if (useMatchSort) {
      this.sort = {
        field: 'match' as any,
        order: -1
      }
    }

    this.resetPagination()
    this.updateUrl()
  }

  onFilter () {
    debugLogger('On filter')

    this.resetPagination()
    this.updateUrl()
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

  // ---------------------------------------------------------------------------

  saveSelectedColumns () {
    const enabled = this.columns.filter(c => c.selected === false).map(c => c.id)

    this.peertubeLocalStorage.setItem(this.getColumnDisabledLocalStorageKey(), JSON.stringify(enabled))
  }

  private loadSelectedColumns () {
    const disabledString = this.peertubeLocalStorage.getItem(this.getColumnDisabledLocalStorageKey())
    if (!disabledString) return

    try {
      const disabled = JSON.parse(disabledString)

      for (const column of this.columns) {
        if (!disabled.includes(column.id)) continue

        column.selected = false
      }
    } catch (err) {
      logger.error('Cannot load selected columns.', err)
    }
  }

  private getColumnDisabledLocalStorageKey () {
    return 'rest-table-columns-disabled-' + this.key()
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
    peertubeLocalStorage.setItem(this.getSortLocalStorageKey(), JSON.stringify(this.sort))
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

  getRandomBadge (type: string, value: string): string {
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

  loadData (options: {
    skipLoader?: boolean // default false
  } = {}) {
    const { skipLoader = false } = options

    if (!skipLoader) this.loading = true

    return new Promise<void>((res, rej) => {
      this.dataLoader()({
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
}
