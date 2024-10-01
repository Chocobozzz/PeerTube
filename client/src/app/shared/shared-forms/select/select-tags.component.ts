import { Component, Input, forwardRef } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { ChipsModule } from 'primeng/chips'

@Component({
  selector: 'my-select-tags',
  templateUrl: './select-tags.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectTagsComponent),
      multi: true
    }
  ],
  standalone: true,
  imports: [ ChipsModule, FormsModule ]
})
export class SelectTagsComponent implements ControlValueAccessor {
  @Input({ required: true }) inputId: string
  @Input() availableItems: string[] = []
  @Input() selectedItems: string[] = []
  @Input() placeholder = $localize`Enter a new tag`

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
