import { ChangeDetectorRef, Component, forwardRef, Input, OnInit } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { secondsToTime, timeToInt } from '../../../assets/player/utils'

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
  ]
})
export class TimestampInputComponent implements ControlValueAccessor, OnInit {
  @Input() maxTimestamp: number
  @Input() timestamp: number
  @Input() disabled = false

  timestampString: string

  constructor (private changeDetector: ChangeDetectorRef) {}

  ngOnInit () {
    this.writeValue(this.timestamp || 0)
  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (timestamp: number) {
    this.timestamp = timestamp

    this.timestampString = secondsToTime(this.timestamp, true, ':')
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
  }
}
