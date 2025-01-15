import { NgClass } from '@angular/common'
import { booleanAttribute, ChangeDetectorRef, Component, EventEmitter, forwardRef, Input, OnInit, Output } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { secondsToTime, timeToInt } from '@peertube/peertube-core-utils'
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

  @Input({ transform: booleanAttribute }) disabled = false
  @Input({ transform: booleanAttribute }) enableBorder = false

  @Input() inputName: string
  @Input() mask = '99:99:99'

  @Input() formatter = (timestamp: number) => secondsToTime({ seconds: timestamp, format: 'full', symbol: ':' })
  @Input() parser = (timestampString: string) => timeToInt(timestampString)

  @Output() inputBlur = new EventEmitter()

  timestampString: string

  constructor (private changeDetector: ChangeDetectorRef) {}

  ngOnInit () {
    this.writeValue(this.timestamp || 0)
  }

  propagateChange = (_: any) => { /* empty */ }

  writeValue (timestamp: number) {
    this.timestamp = timestamp
    this.timestampString = this.formatter(this.timestamp)
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.timestamp = this.parser(this.timestampString)

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
