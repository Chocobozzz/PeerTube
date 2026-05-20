import { Directive, input } from '@angular/core'
import { FieldState } from '@angular/forms/signals'

@Directive({
  selector: '[myFormInputError]',
  standalone: true,
  host: {
    '[class.input-error]': 'hasError()'
  }
})
export class FormInputErrorDirective {
  readonly myFormInputError = input.required<FieldState<any>>()

  hasError () {
    return this.myFormInputError().touched() && this.myFormInputError().invalid()
  }
}
