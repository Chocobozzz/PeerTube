import { booleanAttribute, Component, forwardRef, Input } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { Notifier } from '@app/core'
import { formatICU } from '@app/helpers'
import { SelectOptionsItem } from '../../../../types/select-options-item.model'
import { SelectCheckboxComponent } from './select-checkbox.component'

@Component({
  selector: 'my-select-checkbox-default-all',
  template: `
  <my-select-checkbox
    [(ngModel)]="selectedItems"
    (ngModelChange)="onModelChange()"
    [availableItems]="availableItems"
    [placeholder]="placeholder"
    [inputId]="inputId"

    [selectedItemsLabel]="selectedItemsLabel"

    showClear="false"

    [virtualScroll]="virtualScroll"

    (panelHide)="onPanelHide()"
  >
  </my-select-checkbox>`,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectCheckboxDefaultAllComponent),
      multi: true
    }
  ],
  imports: [ SelectCheckboxComponent, FormsModule ]
})
export class SelectCheckboxDefaultAllComponent implements ControlValueAccessor {
  @Input({ required: true }) inputId: string
  @Input() availableItems: SelectOptionsItem[] = []

  @Input() placeholder: string
  @Input() maxIndividualItems: number

  @Input() allSelectedLabel: string
  @Input() selectedLabel: string

  @Input({ transform: booleanAttribute }) virtualScroll = false

  selectedItemsLabel: string
  selectedItems: string[]

  constructor (private notifier: Notifier) {

  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (items: string[]) {
    if (items) this.selectedItems = items
    else this.selectAll()
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.updateLabel()

    if (!this.isMaxItemsValid()) return

    this.propagateChange(this.buildOutputItems())
  }

  onPanelHide () {
    // Automatically use "All languages" if the user did not select any language
    if (Array.isArray(this.selectedItems) && this.selectedItems.length === 0) {
      this.selectAll()
    }

    this.checkMaxItems()
  }

  private isMaxItemsValid () {
    if (!this.maxIndividualItems) return true

    const outputItems = this.buildOutputItems()
    if (!outputItems) return true

    if (outputItems.length >= this.maxIndividualItems) return false

    return true
  }

  private checkMaxItems () {
    if (!this.isMaxItemsValid()) {
      this.notifier.error(
        formatICU(
          $localize`You can't select more than {maxItems, plural, =1 {1 item} other {{maxItems} items}}`,
          { maxItems: this.maxIndividualItems }
        )
      )

      this.selectAll()
    }
  }

  private selectAll () {
    this.selectedItems = this.availableItems.map(i => i.id + '')

    this.updateLabel()
  }

  private updateLabel () {
    if (this.selectedItems && this.availableItems && this.selectedItems.length === this.availableItems.length) {
      this.selectedItemsLabel = this.allSelectedLabel
    } else {
      this.selectedItemsLabel = this.selectedLabel
    }
  }

  private buildOutputItems () {
    if (!Array.isArray(this.selectedItems)) return undefined

    // null means "All"
    if (this.selectedItems.length === 0 || this.selectedItems.length === this.availableItems.length) {
      return null
    }

    return this.selectedItems
  }
}
