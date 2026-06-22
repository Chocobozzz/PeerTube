import { Component, OnDestroy, OnInit, computed, inject, input, output, signal, ChangeDetectionStrategy } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { NgbDropdown, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap'
import { Subscription } from 'rxjs'
import { SelectOptionsItem } from '../../../types/select-options-item.model'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { ButtonComponent } from '../shared-main/buttons/button.component'
import { PeertubeCheckboxComponent } from './peertube-checkbox.component'
import { SelectOptionsComponent } from './select/select-options.component'
import { SelectTagsComponent } from './select/select-tags.component'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type TitleFilterDef = {
  type: 'title'
  title: string
}

export type OptionsFilterDef<ServiceParameters extends Record<string, any>> = {
  [Key in Extract<keyof ServiceParameters, string>]-?: {
    type: 'options'
    key: Key
    title: string
    options: { label: string, value: ServiceParameters[Key] | 'all', default?: true }[]
  }
}[Extract<keyof ServiceParameters, string>]

export type CheckboxFilterDef<ServiceParameters extends Record<string, any>> = {
  type: 'checkbox'
  key: Extract<keyof ServiceParameters, string>
  label: string
}

export type SelectFilterDef<ServiceParameters extends Record<string, any>> = {
  [Key in Extract<keyof ServiceParameters, string>]-?: {
    type: 'select'
    key: Key
    title: string
    items: SelectOptionsItem<ServiceParameters[Key]>[]
    clearable?: boolean // default true
    filter?: boolean // default false
  }
}[Extract<keyof ServiceParameters, string>]

export type TagsFilterDef<ServiceParameters extends Record<string, any>> = {
  [Key in Extract<keyof ServiceParameters, string>]-?: {
    type: 'tags'
    key: Key
    title: string
  }
}[Extract<keyof ServiceParameters, string>]

export type TextFilterDef<ServiceParameters extends Record<string, any>> = {
  [Key in Extract<keyof ServiceParameters, string>]-?: {
    type: 'text'
    key: Key
    title: string
    constraint?: 'numeric'
    placeholder?: string
  }
}[Extract<keyof ServiceParameters, string>]

export type AdvancedFilterDef<ServiceParameters extends Record<string, any> = any> =
  | TitleFilterDef
  | OptionsFilterDef<ServiceParameters>
  | SelectFilterDef<ServiceParameters>
  | CheckboxFilterDef<ServiceParameters>
  | TagsFilterDef<ServiceParameters>
  | TextFilterDef<ServiceParameters>

export function parseQueryParamsToAdvancedFilters<ServiceParameters extends Record<string, any>> (
  inputFilters: AdvancedFilterDef<ServiceParameters>[],
  queryParams: Record<string, any>,
  defaultValues: Partial<ServiceParameters> = {}
) {
  const result: Record<string, any> = {}

  for (const def of inputFilters) {
    if (def.type === 'title') continue

    const key = def.key
    const raw = queryParams[key]

    if (raw === undefined) {
      if (defaultValues[key] !== undefined) {
        result[key] = defaultValues[key]
        continue
      }

      if (def.type === 'options') {
        if (def.options.some(o => o.value === 'all')) {
          result[key] = 'all'
          continue
        }
      }

      result[key] = undefined
    } else if (def.type === 'checkbox') {
      result[key] = raw === 'true'
    } else if (def.type === 'tags') {
      // Handle tags as comma-separated values or array
      result[key] = Array.isArray(raw) ? raw : (raw ? raw.split(',').map((v: string) => v.trim()) : [])
    } else if (def.type === 'text') {
      result[key] = raw
    } else if (raw === 'true') {
      result[key] = true
    } else if (raw === 'false') {
      result[key] = false
    } else if (!isNaN(+raw)) {
      result[key] = +raw
    } else {
      result[key] = raw
    }
  }

  return result as Partial<ServiceParameters>
}

// ---------------------------------------------------------------------------

@Component({
  selector: 'my-advanced-input-filter',
  templateUrl: './advanced-input-filter.component.html',
  styleUrls: [ './advanced-input-filter.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu,
    GlobalIconComponent,
    FormsModule,
    PeertubeCheckboxComponent,
    SelectOptionsComponent,
    SelectTagsComponent,
    ButtonComponent
  ]
})
export class AdvancedInputFilterComponent<ServiceParameters extends Record<string, any>> implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute)

  readonly filters = input<AdvancedFilterDef<ServiceParameters>[]>([])
  readonly defaultValues = input<Partial<ServiceParameters>>()

  readonly filtersChange = output<Partial<ServiceParameters>>()

  /** Draft state while the dropdown is open – not yet applied. */
  readonly filterState = signal<Partial<ServiceParameters>>({})

  /** Committed/applied state that drives URL params and output emissions. */
  readonly activeFilters = signal<Partial<ServiceParameters>>({})

  /** Number of active (non-empty) filters for the badge. */
  readonly activeCount = computed(() => {
    const active = this.activeFilters()

    return Object.keys(active).filter(k => {
      const value = active[k]
      const filter = this.filters().find(f => 'key' in f && f.key === k)

      if (value === undefined || value === 'all') return false

      if (filter?.type === 'checkbox' && value === false) return false

      return true
    }).length
  })

  readonly hasFilters = computed(() => this.filters().length > 0)

  private routeSub: Subscription
  private defaultValuesToLoad: Partial<ServiceParameters> = {}

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  ngOnInit () {
    this.defaultValuesToLoad = this.defaultValues() || {}

    this.routeSub = this.route.queryParams.subscribe(params => {
      const initial = parseQueryParamsToAdvancedFilters(this.filters(), params, this.defaultValuesToLoad)

      // Only load defaults values on initial load
      this.defaultValuesToLoad = {}

      this.filterState.set({ ...initial })
      this.activeFilters.set({ ...initial })
    })
  }

  ngOnDestroy () {
    this.routeSub?.unsubscribe()
  }

  // ---------------------------------------------------------------------------
  // Template helpers – options filters
  // ---------------------------------------------------------------------------

  isOptionSelected (def: OptionsFilterDef<ServiceParameters>, optionValue: string): boolean {
    const current = this.filterState()[def.key]

    return current === optionValue || current + '' === optionValue
  }

  onOptionClick (def: OptionsFilterDef<ServiceParameters>, optionValue: string) {
    const current = this.filterState()[def.key]

    // Toggle off if already selected
    const next = current === optionValue ? undefined : optionValue
    this.filterState.update(s => ({ ...s, [def.key]: next }))
  }

  onOptionInputClick (event: MouseEvent, def: OptionsFilterDef<ServiceParameters>, optionValue: string) {
    event.preventDefault()
    this.onOptionClick(def, optionValue)
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
  // Template helpers – tags filters
  // ---------------------------------------------------------------------------

  getTagsValue (key: string): string[] {
    return this.filterState()[key]
  }

  setTagsValue (key: string, value: string[]) {
    this.filterState.update(s => ({ ...s, [key]: value?.length > 0 ? value : undefined }))
  }

  // ---------------------------------------------------------------------------
  // Template helpers – text filters
  // ---------------------------------------------------------------------------

  getTextValue (key: string): string {
    const value = this.filterState()[key]
    const filterDef = this.filters().find(f => f.type === 'text' && f.key === key) as TextFilterDef<ServiceParameters>

    if (filterDef.constraint === 'numeric' && isNaN(+value)) return ''

    return value !== undefined ? String(value) : ''
  }

  setTextValue (key: string, value: string) {
    let trimmedValue: number | string = value.trim()

    const filterDef = this.filters().find(f => f.type === 'text' && f.key === key) as TextFilterDef<ServiceParameters>

    if (filterDef.constraint === 'numeric') {
      trimmedValue = +trimmedValue

      if (isNaN(trimmedValue)) trimmedValue = ''
    }

    this.filterState.update(s => ({ ...s, [key]: trimmedValue || undefined }))
  }

  // ---------------------------------------------------------------------------

  applyFilters (dropdown: NgbDropdown) {
    this.activeFilters.set({ ...this.filterState() })

    this.emitOutputs()

    dropdown.close()
  }

  resetFilters (dropdown: NgbDropdown) {
    const empty: Partial<ServiceParameters> = parseQueryParamsToAdvancedFilters(this.filters(), {}, this.defaultValues())

    this.filterState.set(empty)
    this.activeFilters.set(empty)

    this.emitOutputs()

    dropdown.close()
  }

  onDropdownOpen () {
    // Sync draft state with committed state when dropdown is re-opened
    this.filterState.set({ ...this.activeFilters() })
  }

  private emitOutputs () {
    const active = this.activeFilters()

    this.filtersChange.emit(active)
  }
}
