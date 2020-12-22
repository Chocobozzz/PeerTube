import { Component, forwardRef, Input } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { Notifier } from '@app/core'

@Component({
  selector: 'my-input-toggle-hidden',
  templateUrl: './input-toggle-hidden.component.html',
  styleUrls: [ './input-toggle-hidden.component.scss' ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputToggleHiddenComponent),
      multi: true
    }
  ]
})
export class InputToggleHiddenComponent implements ControlValueAccessor {
  @Input() inputId = Math.random().toString(11).slice(2, 8) // id cannot be left empty or undefined
  @Input() value = ''
  @Input() autocomplete = 'off'
  @Input() placeholder = ''
  @Input() tabindex = 0
  @Input() withToggle = true
  @Input() withCopy = false
  @Input() readonly = false
  @Input() show = false

  constructor (private notifier: Notifier) { }

  get inputType () {
    return this.show
      ? 'text'
      : 'password'
  }

  get toggleTitle () {
    return this.show
      ? $localize`Hide`
      : $localize`Show`
  }

  toggle () {
    this.show = !this.show
  }

  activateCopiedMessage () {
    this.notifier.success($localize`Copied`)
  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (value: string) {
    this.value = value
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  update () {
    this.propagateChange(this.value)
  }
}
