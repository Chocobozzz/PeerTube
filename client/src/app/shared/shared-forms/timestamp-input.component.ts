import { ChangeDetectorRef, Component, EventEmitter, forwardRef, Input, OnInit, Output } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms'
import { secondsToTime, timeToInt } from '@peertube/peertube-core-utils'
import { NgClass } from '@angular/common'
import { InputMaskModule } from 'primeng/inputmask'

@Component({
  selector: 'my-timestamp-input',
  styleUrls: [ './timestamp-input.component.scss' ],
  templateUrl: './timestamp-input.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TimestampInputComponent),
      multi: true
    }
  ],
  standalone: true,
  imports: [ InputMaskModule, FormsModule, NgClass ]
})
export class TimestampInputComponent implements ControlValueAccessor, OnInit {
  @Input() maxTimestamp: number
  @Input() timestamp: number
  @Input() disabled = false
  @Input() inputName: string
  @Input() disableBorder = true

  @Output() inputBlur = new EventEmitter()

  timestampString: string

  constructor (private changeDetector: ChangeDetectorRef) {}

  ngOnInit () {
    this.writeValue(this.timestamp || 0)
  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (timestamp: number) {
    this.timestamp = timestamp

    this.timestampString = secondsToTime({ seconds: this.timestamp, format: 'full', symbol: ':' })
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.timestamp = timeToInt(this.timestampString)

    this.propagateChange(this.timestamp)
  }

  onBlur () {
    if (this.maxTimestamp && this.timestamp > this.maxTimestamp) {
      this.writeValue(this.maxTimestamp)

      this.changeDetector.detectChanges()

      this.propagateChange(this.timestamp)
    }

    this.inputBlur.emit()
  }
}
