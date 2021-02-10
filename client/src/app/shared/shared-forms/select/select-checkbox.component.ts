import { Component, forwardRef, Input, OnInit } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { SelectOptionsItem } from '../../../../types/select-options-item.model'

export type ItemSelectCheckboxValue = { id?: string | number, group?: string } | string

@Component({
  selector: 'my-select-checkbox',
  styleUrls: [ './select-shared.component.scss', 'select-checkbox.component.scss' ],
  templateUrl: './select-checkbox.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectCheckboxComponent),
      multi: true
    }
  ]
})
export class SelectCheckboxComponent implements OnInit, ControlValueAccessor {
  @Input() availableItems: SelectOptionsItem[] = []
  @Input() selectedItems: ItemSelectCheckboxValue[] = []
  @Input() selectableGroup: boolean
  @Input() selectableGroupAsModel: boolean
  @Input() maxSelectedItems: number
  @Input() placeholder: string

  ngOnInit () {
    if (!this.placeholder) this.placeholder = $localize`Add a new option`
  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (items: ItemSelectCheckboxValue[]) {
    if (Array.isArray(items)) {
      this.selectedItems = items.map(i => {
        if (typeof i === 'string' || typeof i === 'number') {
          return i + ''
        }

        if (i.group) {
          return { group: i.group }
        }

        return { id: i.id + '' }
      })
    } else {
      this.selectedItems = items
    }

    this.propagateChange(this.selectedItems)
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

  compareFn (item: SelectOptionsItem, selected: ItemSelectCheckboxValue) {
    if (typeof selected === 'string') {
      return item.id === selected
    }

    if (this.selectableGroup && item.group && selected.group) {
      return item.group === selected.group
    }

    if (selected.id && item.id) {
      return item.id === selected.id
    }

    return false
  }
}
