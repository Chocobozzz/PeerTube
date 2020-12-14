import { Component, forwardRef, Input } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'

@Component({
  selector: 'my-select-custom-input',
  styleUrls: [ './select-custom-input.component.scss' ],
  templateUrl: './select-custom-input.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectCustomInputComponent),
      multi: true
    }
  ]
})
export class SelectCustomInputComponent implements ControlValueAccessor {
  @Input() items: any[] = []

  selectedId: number

  // ng-select options
  bindLabel = 'label'
  bindValue = 'id'
  clearable = false
  searchable = false

  propagateChange = (_: any) => { /* empty */ }

  writeValue (id: number) {
    this.selectedId = id
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.propagateChange(this.selectedId)
  }
}
