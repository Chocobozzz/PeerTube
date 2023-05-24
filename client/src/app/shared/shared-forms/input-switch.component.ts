import { Component, forwardRef, Input } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'

@Component({
  selector: 'my-input-switch',
  styleUrls: [ './input-switch.component.scss' ],
  templateUrl: './input-switch.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputSwitchComponent),
      multi: true
    }
  ]
})
export class InputSwitchComponent implements ControlValueAccessor {
  @Input() checked = false
  @Input() inputName: string

  propagateChange = (_: any) => { /* empty */ }

  writeValue (checked: boolean) {
    console.log(checked)
    this.checked = checked
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  update () {
    console.log(this.checked)
    this.checked = !this.checked
    this.propagateChange(this.checked)
  }
}
