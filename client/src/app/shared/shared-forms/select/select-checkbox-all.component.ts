import { Component, forwardRef, Input } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { Notifier } from '@app/core'
import { formatICU } from '@app/helpers'
import { SelectOptionsItem } from '../../../../types/select-options-item.model'
import { ItemSelectCheckboxValue } from './select-checkbox.component'

@Component({
  selector: 'my-select-checkbox-all',
  styleUrls: [ './select-shared.component.scss' ],

  template: `
  <my-select-checkbox
    [(ngModel)]="selectedItems"
    (ngModelChange)="onModelChange()"
    [availableItems]="availableItems"
    [selectableGroup]="true" [selectableGroupAsModel]="true"
    [placeholder]="placeholder"
    (focusout)="onBlur()"
  >
  </my-select-checkbox>`,

  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectCheckboxAllComponent),
      multi: true
    }
  ]
})
export class SelectCheckboxAllComponent implements ControlValueAccessor {
  @Input() availableItems: SelectOptionsItem[] = []
  @Input() allGroupLabel: string

  @Input() placeholder: string
  @Input() maxItems: number

  selectedItems: ItemSelectCheckboxValue[]

  constructor (
    private notifier: Notifier
  ) {

  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (items: string[]) {
    this.selectedItems = items
      ? items.map(l => ({ id: l }))
      : [ { group: this.allGroupLabel } ]
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    if (!this.isMaxConstraintValid()) return

    this.propagateChange(this.buildOutputItems())
  }

  onBlur () {
    // Automatically use "All languages" if the user did not select any language
    if (Array.isArray(this.selectedItems) && this.selectedItems.length === 0) {
      this.selectedItems = [ { group: this.allGroupLabel } ]
    }
  }

  private isMaxConstraintValid () {
    if (!this.maxItems) return true

    const outputItems = this.buildOutputItems()
    if (!outputItems) return true

    if (outputItems.length >= this.maxItems) {
      this.notifier.error(
        formatICU(
          $localize`You can't select more than {maxItems, plural, =1 {1 item} other {{maxItems} items}}`,
          { maxItems: this.maxItems }
        )
      )

      return false
    }

    return true
  }

  private buildOutputItems () {
    if (!Array.isArray(this.selectedItems)) return undefined

    // null means "All"
    if (this.selectedItems.length === 0 || this.selectedItems.length === this.availableItems.length) {
      return null
    }

    if (this.selectedItems.length === 1) {
      const item = this.selectedItems[0]

      const itemGroup = typeof item === 'string' || typeof item === 'number'
        ? item
        : item.group

      if (itemGroup === this.allGroupLabel) return null
    }

    return this.selectedItems.map(l => {
      if (typeof l === 'string' || typeof l === 'number') return l

      if (l.group) return l.group

      return l.id + ''
    })
  }
}
