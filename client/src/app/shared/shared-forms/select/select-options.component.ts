import { Component, Input, forwardRef } from '@angular/core'
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms'

export type SelectOptionsItem = {
  id: string | number
  label: string
  description?: string
  group?: string
  groupLabel?: string
}

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
