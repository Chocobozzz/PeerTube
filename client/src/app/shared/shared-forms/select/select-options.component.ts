import { booleanAttribute, Component, forwardRef, HostListener, Input } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms'
import { SelectOptionsItem } from '../../../../types/select-options-item.model'
import { NgIf } from '@angular/common'
import { NgSelectModule } from '@ng-select/ng-select'

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
  ],
  standalone: true,
  imports: [ NgSelectModule, FormsModule, NgIf ]
})
export class SelectOptionsComponent implements ControlValueAccessor {
  @Input() items: SelectOptionsItem[] = []

  @Input({ transform: booleanAttribute }) clearable = false
  @Input({ transform: booleanAttribute }) searchable = false

  @Input() groupBy: string
  @Input() labelForId: string

  @Input() searchFn: any

  selectedId: number | string
  disabled = false

  propagateChange = (_: any) => { /* empty */ }

  // Allow plugins to update our value
  @HostListener('change', [ '$event.target' ])
  handleChange (event: any) {
    this.writeValue(event.value)
    this.onModelChange()
  }

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

  setDisabledState (isDisabled: boolean) {
    this.disabled = isDisabled
  }
}
