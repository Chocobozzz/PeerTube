import { ChangeDetectorRef, Component, forwardRef, Input, OnChanges, SimpleChanges } from '@angular/core'
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
  @Input() disabled = false

  // FIXME: https://github.com/angular/angular/issues/10816#issuecomment-307567836
  @Input() onPushWorkaround = false

  constructor (private cdr: ChangeDetectorRef) { }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (checked: boolean) {
    this.checked = checked

    if (this.onPushWorkaround) {
      this.cdr.markForCheck()
    }
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
    this.disabled = isDisabled
  }
}
