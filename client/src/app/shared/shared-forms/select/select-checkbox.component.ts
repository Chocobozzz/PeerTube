import { CommonModule } from '@angular/common'
import { booleanAttribute, Component, EventEmitter, forwardRef, Input, numberAttribute, Output } from '@angular/core'
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
  imports: [ MultiSelectModule, FormsModule, CommonModule ]
})
export class SelectCheckboxComponent implements ControlValueAccessor {
  @Input({ required: true }) inputId: string

  @Input() availableItems: SelectOptionsItem[] = []
  @Input() selectedItems: string[] = []

  @Input() selectableGroup: boolean
  @Input() selectableGroupAsModel: boolean
  @Input() placeholder: string

  @Input() selectionLimit: number

  @Input() selectedItemsLabel: string

  @Input({ transform: booleanAttribute }) virtualScroll = false
  @Input({ transform: numberAttribute }) virtualScrollItemSize = 33

  @Input({ transform: booleanAttribute }) showClear: boolean

  @Output() panelHide = new EventEmitter()

  disabled = false

  propagateChange = (_: any) => { /* empty */ }

  writeValue (items: string[]) {
    this.selectedItems = items
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.propagateChange(this.selectedItems)
  }

  setDisabledState (isDisabled: boolean) {
    this.disabled = isDisabled
  }
}
