import { AfterViewInit, Component, OnInit, booleanAttribute, computed, inject, input, output, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { NgbDropdown, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap'
import { SelectOptionsItem } from '../../../types/select-options-item.model'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { ButtonComponent } from '../shared-main/buttons/button.component'
import { PeertubeCheckboxComponent } from './peertube-checkbox.component'
import { SelectOptionsComponent } from './select/select-options.component'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type OptionsFilterOption = {
  label: string
  value: string
  /** Optional raw token(s) override used when assembling the legacy search string (e.g. 'webVideos:true isLocal:true'). */
  rawToken?: string
}

export type OptionsFilterDef = {
  type: 'options'
  key: string
  title: string
  options: OptionsFilterOption[]
}

export type CheckboxFilterDef = {
  type: 'checkbox'
  key: string
  label: string
}

export type SelectFilterDef = {
  type: 'select'
  key: string
  title: string
  items: SelectOptionsItem[]
  clearable?: boolean
}

export type FilterDef = OptionsFilterDef | CheckboxFilterDef | SelectFilterDef

/** Map of filter key → active value (string, boolean or undefined when cleared). */
export type FilterValues = Record<string, string | boolean | undefined>

// ---------------------------------------------------------------------------

@Component({
  selector: 'my-advanced-input-filter',
  templateUrl: './advanced-input-filter.component.html',
  styleUrls: [ './advanced-input-filter.component.scss' ],
  imports: [
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu,
    GlobalIconComponent,
    FormsModule,
    PeertubeCheckboxComponent,
    SelectOptionsComponent,
    ButtonComponent
  ]
})
export class AdvancedInputFilterComponent implements OnInit, AfterViewInit {
  private route = inject(ActivatedRoute)
  private router = inject(Router)

  readonly filters = input<FilterDef[]>([])
  readonly emitOnInit = input(false, { transform: booleanAttribute })

  /** Emits the active filters as a typed record. */
  readonly filtersChange = output<FilterValues>()

  /**
   * Backward-compatible search string output.
   * Assembles a token string (e.g. `state:pending banned:true`) from the active filter values
   * so existing consumers using `table.onSearch($event)` keep working without changes.
   */
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly search = output<string>()

  /** Draft state while the dropdown is open – not yet applied. */
  readonly filterState = signal<FilterValues>({})

  /** Committed/applied state that drives URL params and output emissions. */
  readonly activeFilters = signal<FilterValues>({})

  /** Number of active (non-empty) filters for the badge. */
  readonly activeCount = computed(() => {
    const active = this.activeFilters()

    return Object.keys(active).filter(k => active[k] !== undefined && active[k] !== false && active[k] !== '').length
  })

  readonly hasFilters = computed(() => this.filters().length > 0)

  private viewInitialized = false

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  ngOnInit () {
    const queryParams = this.route.snapshot.queryParams
    const initial: FilterValues = {}

    for (const def of this.filters()) {
      const key = def.key
      const raw = queryParams[key]

      if (raw === undefined) continue

      if (def.type === 'checkbox') {
        initial[key] = raw === 'true'
      } else {
        initial[key] = raw
      }
    }

    this.filterState.set({ ...initial })
    this.activeFilters.set({ ...initial })
  }

  ngAfterViewInit () {
    this.viewInitialized = true

    if (this.emitOnInit()) {
      this.emitOutputs()
    }
  }

  // ---------------------------------------------------------------------------
  // Template helpers – options filters
  // ---------------------------------------------------------------------------

  isOptionSelected (def: OptionsFilterDef, optionValue: string): boolean {
    return this.filterState()[def.key] === optionValue
  }

  onOptionClick (def: OptionsFilterDef, optionValue: string) {
    const current = this.filterState()[def.key]

    // Toggle off if already selected
    const next = current === optionValue ? undefined : optionValue
    this.filterState.update(s => ({ ...s, [def.key]: next }))
  }

  // ---------------------------------------------------------------------------
  // Template helpers – checkbox filters
  // ---------------------------------------------------------------------------

  getCheckboxValue (key: string): boolean {
    return this.filterState()[key] === true
  }

  setCheckboxValue (key: string, value: boolean) {
    this.filterState.update(s => ({ ...s, [key]: value || undefined }))
  }

  // ---------------------------------------------------------------------------
  // Template helpers – select filters
  // ---------------------------------------------------------------------------

  getSelectValue (key: string): string | undefined {
    const v = this.filterState()[key]
    return v !== undefined ? String(v) : undefined
  }

  setSelectValue (key: string, value: string | undefined) {
    this.filterState.update(s => ({ ...s, [key]: value || undefined }))
  }

  // ---------------------------------------------------------------------------

  applyFilters (dropdown: NgbDropdown) {
    this.activeFilters.set({ ...this.filterState() })
    this.updateQueryParams()
    this.emitOutputs()
    dropdown.close()
  }

  resetFilters (dropdown: NgbDropdown) {
    const empty: FilterValues = {}
    this.filterState.set(empty)
    this.activeFilters.set(empty)
    this.updateQueryParams()
    this.emitOutputs()
    dropdown.close()
  }

  onDropdownOpen () {
    // Sync draft state with committed state when dropdown is re-opened
    this.filterState.set({ ...this.activeFilters() })
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private updateQueryParams () {
    const newParams: Record<string, string | undefined> = {}
    const active = this.activeFilters()

    for (const def of this.filters()) {
      const key = def.key
      const value = active[key]

      newParams[key] = value !== undefined && value !== false && value !== ''
        ? String(value)
        : undefined
    }

    this.router.navigate([ '.' ], {
      relativeTo: this.route,
      queryParams: { ...this.route.snapshot.queryParams, ...newParams }
    })
  }

  private emitOutputs () {
    if (!this.viewInitialized) return

    const active = this.activeFilters()

    this.filtersChange.emit(active)
    this.search.emit(this.assembleTokenString(active))
  }

  /**
   * Builds a legacy token search string from the active filter values.
   * E.g. `{ state: 'pending', banned: true }` → `"state:pending banned:true"`
   */
  private assembleTokenString (filters: FilterValues): string {
    const tokens: string[] = []

    for (const def of this.filters()) {
      const key = def.key
      const value = filters[key]

      if (value === undefined || value === false || value === '') continue

      if (def.type === 'options') {
        const option = def.options.find(o => o.value === value)

        if (option?.rawToken) {
          tokens.push(option.rawToken)
        } else if (value) {
          tokens.push(`${key}:${value}`)
        }
      } else if (def.type === 'checkbox') {
        if (value === true) tokens.push(`${key}:true`)
      } else if (def.type === 'select') {
        if (value) tokens.push(`${key}:${value}`)
      }
    }

    return tokens.join(' ')
  }
}
