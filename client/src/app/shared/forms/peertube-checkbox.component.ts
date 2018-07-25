import { Component, forwardRef, Input } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'

@Component({
  selector: 'my-peertube-checkbox',
  styleUrls: [ './peertube-checkbox.component.scss' ],
  templateUrl: './peertube-checkbox.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PeertubeCheckboxComponent),
      multi: true
    }
  ]
})
export class PeertubeCheckboxComponent implements ControlValueAccessor {
  @Input() checked = false
  @Input() inputName: string
  @Input() labelText: string
  @Input() labelHtml: string
  @Input() helpHtml: string

  isDisabled = false

  propagateChange = (_: any) => { /* empty */ }

  writeValue (checked: boolean) {
    this.checked = checked
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.propagateChange(this.checked)
  }

  setDisabledState (isDisabled: boolean) {
    this.isDisabled = isDisabled
  }
}
