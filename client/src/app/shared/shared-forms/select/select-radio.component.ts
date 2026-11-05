import { CommonModule } from '@angular/common'
import { booleanAttribute, Component, forwardRef, inject, input, model, ChangeDetectionStrategy } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { ScreenService } from '@app/core'
import { SelectRadioItem } from '@pt-types'

@Component({
  selector: 'my-select-radio',

  templateUrl: './select-radio.component.html',
  styleUrls: [ './select-radio.component.scss' ],

  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectRadioComponent),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ FormsModule, CommonModule ]
})
export class SelectRadioComponent implements ControlValueAccessor {
  readonly items = input.required<SelectRadioItem[]>()
  readonly inputId = input.required<string>()

  readonly label = input<string>()
  readonly isGroup = input(false, { transform: booleanAttribute })
  readonly labelSecondary = input(false, { transform: booleanAttribute })

  // Id of an external element labelling the radio group, if the label input is not used
  readonly ariaLabelledby = input<string>()

  private readonly screenService = inject(ScreenService)

  readonly value = model('')

  disabled = false

  wroteValue: number | string

  propagateChange = (_: any) => {
    // empty
  }

  writeValue (value: string) {
    this.value.set(value)
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  setDisabledState (isDisabled: boolean) {
    this.disabled = isDisabled
  }

  update () {
    this.propagateChange(this.value())
  }

  getRadioId (item: SelectRadioItem) {
    // Item ids may come from plugins and contain characters that are invalid in an HTML id
    return this.inputId() + '-' + String(item.id).replace(/[^\w-]/g, '_')
  }

  getLabelId () {
    return this.inputId() + '-label'
  }

  getLabelledBy () {
    if (this.ariaLabelledby()) return this.ariaLabelledby()
    if (this.label()) return this.getLabelId()

    return null
  }

  isInMobileView () {
    return this.screenService.isInMobileView()
  }
}
