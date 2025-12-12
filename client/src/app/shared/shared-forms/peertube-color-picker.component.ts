import { NgClass } from '@angular/common'
import { Component, forwardRef, input, model } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { ColorPickerModule } from 'primeng/colorpicker'
import { FormReactiveErrors } from './form-reactive.service'

@Component({
  selector: 'my-peertube-color-picker',
  templateUrl: './peertube-color-picker.component.html',
  styleUrls: [ './peertube-color-picker.component.scss' ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PeertubeColorPickerComponent),
      multi: true
    }
  ],
  imports: [ FormsModule, NgClass, ColorPickerModule ]
})
export class PeertubeColorPickerComponent implements ControlValueAccessor {
  readonly inputId = input.required<string>()

  readonly formError = input<string | FormReactiveErrors | FormReactiveErrors[]>(undefined)

  readonly value = model('')
  readonly numberSign = '#'
  sixCharacters: string

  get sixCharactersInputId () {
    return `${this.inputId()}SixCharacters`
  }

  propagateChange = (_: any) => {
    // empty
  }

  writeValue (value: string) {
    this.value.set(value)
    this.updateSixCharactersOnValueChange()
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onValueModelChange () {
    this.updateSixCharactersOnValueChange()
    this.propagateChange(this.value())
  }

  onSixCharactersModelChange(){
    this.updateValueOnSixCharactersChange()
    this.propagateChange(this.value())
  }

  updateSixCharactersOnValueChange(){
    this.sixCharacters = this.value().substring(1)
  }

  updateValueOnSixCharactersChange(){
    this.value.set(`${this.numberSign}${this.sixCharacters}`)
  }
}
