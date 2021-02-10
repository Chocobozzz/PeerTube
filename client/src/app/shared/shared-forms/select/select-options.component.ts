import { Component, forwardRef, Input } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { SelectOptionsItem } from '../../../../types/select-options-item.model'

@Component({
  selector: 'my-select-options',
  styleUrls: [ './select-shared.component.scss' ],
  templateUrl: './select-options.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectOptionsComponent),
      multi: true
    }
  ]
})
export class SelectOptionsComponent implements ControlValueAccessor {
  @Input() items: SelectOptionsItem[] = []
  @Input() clearable = false
  @Input() searchable = false
  @Input() groupBy: string
  @Input() labelForId: string
  @Input() searchFn: any

  selectedId: number | string

  propagateChange = (_: any) => { /* empty */ }

  writeValue (id: number | string) {
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
