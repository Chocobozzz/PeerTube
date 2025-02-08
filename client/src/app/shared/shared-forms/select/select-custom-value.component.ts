import { Component, forwardRef, Input, OnChanges } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms'
import { SelectOptionsItem } from '../../../../types/select-options-item.model'
import { NgIf } from '@angular/common'
import { SelectOptionsComponent } from './select-options.component'

@Component({
  selector: 'my-select-custom-value',
  templateUrl: './select-custom-value.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectCustomValueComponent),
      multi: true
    }
  ],
  imports: [ SelectOptionsComponent, FormsModule, NgIf ]
})
export class SelectCustomValueComponent implements ControlValueAccessor, OnChanges {
  @Input({ required: true }) inputId: string
  @Input({ required: true }) labelId: string

  @Input() items: SelectOptionsItem[] = []

  @Input() clearable = false
  @Input() searchable = false

  @Input() inputSuffix: string
  @Input() inputType = 'text'

  customValue: number | string = ''
  selectedId: number | string
  disabled = false

  itemsWithCustom: SelectOptionsItem[] = []

  ngOnChanges () {
    this.itemsWithCustom = this.getItems()
  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (id: number | string) {
    this.selectedId = id

    if (this.isSelectedIdInItems() !== true) {
      this.selectedId = 'other'
      this.customValue = id
    }
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    if (this.selectedId === 'other') {
      return this.propagateChange(this.customValue)
    }

    return this.propagateChange(this.selectedId)
  }

  isSelectedIdInItems () {
    return !!this.items.find(i => i.id === this.selectedId)
  }

  getItems () {
    const other: SelectOptionsItem = {
      id: 'other',
      label: $localize`Custom value...`
    }

    return this.items.concat([ other ])
  }

  isCustomValue () {
    return this.selectedId === 'other'
  }

  setDisabledState (isDisabled: boolean) {
    this.disabled = isDisabled
  }
}
