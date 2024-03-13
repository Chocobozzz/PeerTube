import { Component, Input, forwardRef } from '@angular/core'
import { NG_VALUE_ACCESSOR, ControlValueAccessor, FormsModule } from '@angular/forms'
import { NgSelectModule } from '@ng-select/ng-select'

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
  ],
  standalone: true,
  imports: [ NgSelectModule, FormsModule ]
})
export class SelectTagsComponent implements ControlValueAccessor {
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
