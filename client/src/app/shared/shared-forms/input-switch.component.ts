import { Component, forwardRef, input, model } from '@angular/core'
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
  ],
  standalone: true
})
export class InputSwitchComponent implements ControlValueAccessor {
  readonly checked = model(false)
  readonly inputName = input<string>(undefined)
  readonly preventUpdate = input(false)
  readonly label = input($localize`Toggle`)

  propagateChange = (_: any) => {
    // empty
  }

  writeValue (checked: boolean) {
    this.checked.set(checked)
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  update () {
    this.checked.set(!this.checked())
    this.propagateChange(this.checked())
  }
}
