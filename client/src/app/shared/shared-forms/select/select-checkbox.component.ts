import { booleanAttribute, Component, forwardRef, input, model, numberAttribute, output } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { MultiSelectModule } from 'primeng/multiselect'
import { SelectOptionsItem } from '../../../../types/select-options-item.model'

@Component({
  selector: 'my-select-checkbox',
  templateUrl: './select-checkbox.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectCheckboxComponent),
      multi: true
    }
  ],
  imports: [ MultiSelectModule, FormsModule ]
})
export class SelectCheckboxComponent implements ControlValueAccessor {
  readonly inputId = input.required<string>()

  readonly availableItems = input<SelectOptionsItem[]>([])
  readonly selectedItems = model<string[]>([])

  readonly selectableGroup = input<boolean>(undefined)
  readonly selectableGroupAsModel = input<boolean>(undefined)
  readonly placeholder = input<string>(undefined)

  readonly selectedItemsLabel = input<string>(undefined)

  readonly virtualScroll = input(false, { transform: booleanAttribute })
  readonly virtualScrollItemSize = input(33, { transform: numberAttribute })

  readonly showClear = input<boolean, unknown>(undefined, { transform: booleanAttribute })
  readonly showToggleAll = input<boolean, unknown>(undefined, { transform: booleanAttribute })

  readonly panelHide = output()

  disabled = false

  propagateChange = (_: any) => {
    // empty
  }

  writeValue (items: string[]) {
    this.selectedItems.set(items)
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.propagateChange(this.selectedItems())
  }

  setDisabledState (isDisabled: boolean) {
    this.disabled = isDisabled
  }
}
