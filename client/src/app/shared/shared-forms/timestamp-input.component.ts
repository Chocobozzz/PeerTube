import { NgClass } from '@angular/common'
import { booleanAttribute, ChangeDetectorRef, Component, forwardRef, OnInit, inject, input, model, output } from '@angular/core'
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
  imports: [ InputMaskModule, FormsModule, NgClass ]
})
export class TimestampInputComponent implements ControlValueAccessor, OnInit {
  private changeDetector = inject(ChangeDetectorRef)

  readonly maxTimestamp = input<number>(undefined)
  readonly timestamp = model<number>(undefined)

  readonly disabled = input(false, { transform: booleanAttribute })
  readonly enableBorder = input(false, { transform: booleanAttribute })

  readonly inputName = input<string>(undefined)
  readonly mask = input('99:99:99')

  readonly formatter = input((timestamp: number) => secondsToTime({ seconds: timestamp, format: 'full', symbol: ':' }))
  readonly parser = input((timestampString: string) => timeToInt(timestampString))

  readonly inputBlur = output()

  timestampString: string

  ngOnInit () {
    this.writeValue(this.timestamp() || 0)
  }

  propagateChange = (_: any) => {
    // empty
  }

  writeValue (timestamp: number) {
    this.timestamp.set(timestamp)
    this.timestampString = this.formatter()(this.timestamp())
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.timestamp.set(this.parser()(this.timestampString))

    this.propagateChange(this.timestamp())
  }

  onBlur () {
    const maxTimestamp = this.maxTimestamp()
    if (maxTimestamp && this.timestamp() > maxTimestamp) {
      this.writeValue(maxTimestamp)

      this.changeDetector.detectChanges()

      this.propagateChange(this.timestamp())
    }

    this.inputBlur.emit()
  }
}
