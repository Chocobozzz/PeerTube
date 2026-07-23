import { CommonModule } from '@angular/common'
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChild,
  forwardRef,
  HostListener,
  inject,
  input,
  numberAttribute,
  output,
  TemplateRef
} from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { SelectItemGroup } from 'primeng/api'
import { SelectModule } from 'primeng/select'
import { SelectOptionsGroup, SelectOptionsItem } from '../../../../types/select-options-item.model'

@Component({
  selector: 'my-select-options',

  templateUrl: './select-options.component.html',
  styleUrls: [ './select-options.component.scss' ],

  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectOptionsComponent),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ SelectModule, FormsModule, CommonModule ]
})
export class SelectOptionsComponent implements ControlValueAccessor {
  private cd = inject(ChangeDetectorRef)

  readonly items = input<SelectOptionsItem[] | SelectOptionsGroup[]>([])

  readonly inputId = input.required<string>()

  readonly clearable = input(false, { transform: booleanAttribute })
  readonly filter = input(false, { transform: booleanAttribute })
  readonly resetFilterOnHide = input(false, { transform: booleanAttribute })
  readonly small = input(false, { transform: booleanAttribute })
  readonly placeholder = input('')

  readonly group = input(false, { transform: booleanAttribute })

  readonly filterPlaceholder = input($localize`Search`)
  readonly emptyFilterMessage = input($localize`No results found`)
  readonly emptyMessage = input($localize`No items available`)

  readonly appendTo = input<'body'>()

  readonly virtualScroll = input(false, { transform: booleanAttribute })
  readonly virtualScrollItemSize = input(39, { transform: numberAttribute })

  // eslint-disable-next-line @angular-eslint/no-output-on-prefix
  readonly onHide = output()
  // eslint-disable-next-line @angular-eslint/no-output-on-prefix
  readonly onFilter = output<{ filter: string }>()

  @ContentChild('selectOption', { descendants: false })
  selectOptionTemplate: TemplateRef<any>

  @ContentChild('itemExtra', { descendants: false })
  itemExtraTemplate: TemplateRef<any>

  selectedId: number | string
  disabled = false

  wroteValue: number | string

  propagateChange = (_: any) => {
    // empty
  }

  // Allow plugins to update our value
  @HostListener('change', [ '$event.target' ])
  handleChange (target: EventTarget) {
    const el = target as HTMLInputElement

    // Prevent the primeng search input to update our value
    if (el.role === 'searchbox') return

    this.writeValue(el.value)
    this.onModelChange()
  }

  writeValue (id: number | string) {
    this.selectedId = id

    // https://github.com/primefaces/primeng/issues/14609 workaround
    this.wroteValue = id
    this.cd.detectChanges()
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    if (this.wroteValue !== undefined && this.wroteValue === this.selectedId) {
      return
    }

    this.wroteValue = undefined

    this.propagateChange(this.selectedId)
  }

  setDisabledState (isDisabled: boolean) {
    this.disabled = isDisabled
  }

  getSelectedItem () {
    const items = this.group()
      ? (this.items() as unknown as SelectItemGroup[]).reduce((acc, group) => acc.concat(group.items), [])
      : this.items()

    return items.find(i => i.id === this.selectedId)
  }
}
