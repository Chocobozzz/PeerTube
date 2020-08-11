import { Component, Input, forwardRef } from '@angular/core'
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms'

@Component({
  selector: 'my-select-tags',
  styleUrls: [ './select-shared.component.scss', './select-tags.component.scss' ],
  templateUrl: './select-tags.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectTagsComponent),
      multi: true
    }
  ]
})
export class SelectTagsComponent implements ControlValueAccessor {
  @Input() availableItems: string[] = []
  @Input() selectedItems: string[] = []

  propagateChange = (_: any) => { /* empty */ }

  writeValue (items: string[]) {
    this.selectedItems = items
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
}
