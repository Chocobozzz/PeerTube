import { AfterViewInit, Component, ElementRef, forwardRef, Input, ViewChild } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms'
import { FormReactiveErrors } from './form-reactive.service'
import { CopyButtonComponent } from '../shared-main/buttons/copy-button.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { NgClass, NgIf } from '@angular/common'

@Component({
  selector: 'my-input-text',
  templateUrl: './input-text.component.html',
  styleUrls: [ './input-text.component.scss' ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputTextComponent),
      multi: true
    }
  ],
  imports: [ FormsModule, NgClass, NgIf, GlobalIconComponent, CopyButtonComponent ]
})
export class InputTextComponent implements ControlValueAccessor, AfterViewInit {
  @ViewChild('input') inputElement: ElementRef

  @Input({ required: true }) inputId: string

  @Input() value = ''
  @Input() autocomplete = 'off'
  @Input() placeholder = ''
  @Input() tabindex = 0
  @Input() withToggle = true
  @Input() withCopy = false
  @Input() readonly = false
  @Input() show = false
  @Input() formError: string | FormReactiveErrors | FormReactiveErrors[]
  @Input() autofocus = false
  @Input() ariaLabel: string

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

  ngAfterViewInit () {
    if (this.autofocus !== true) return

    this.inputElement.nativeElement.focus({ preventScroll: true })
  }

  toggle () {
    this.show = !this.show
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

  focus () {
    const el: HTMLElement = this.inputElement.nativeElement

    el.focus({ preventScroll: true })
  }
}
