import { FormBuilder, FormControl, FormGroup, ValidatorFn } from '@angular/forms'
import { Injectable } from '@angular/core'
import { FormReactiveErrors, FormReactiveValidationMessages } from '@app/shared/forms/form-reactive'

export type BuildFormValidator = {
  VALIDATORS: ValidatorFn[],
  MESSAGES: { [ name: string ]: string }
}
export type BuildFormArgument = {
  [ id: string ]: BuildFormValidator
}
export type BuildFormDefaultValues = {
  [ name: string ]: string | string[]
}

@Injectable()
export class FormValidatorService {

  constructor (
    private formBuilder: FormBuilder
  ) {}

  buildForm (obj: BuildFormArgument, defaultValues: BuildFormDefaultValues = {}) {
    const formErrors: FormReactiveErrors = {}
    const validationMessages: FormReactiveValidationMessages = {}
    const group: { [key: string]: any } = {}

    for (const name of Object.keys(obj)) {
      formErrors[name] = ''

      const field = obj[name]
      if (field && field.MESSAGES) validationMessages[name] = field.MESSAGES

      const defaultValue = defaultValues[name] || ''

      if (field && field.VALIDATORS) group[name] = [ defaultValue, field.VALIDATORS ]
      else group[name] = [ defaultValue ]
    }

    const form = this.formBuilder.group(group)
    return { form, formErrors, validationMessages }
  }

  updateForm (
    form: FormGroup,
    formErrors: FormReactiveErrors,
    validationMessages: FormReactiveValidationMessages,
    obj: BuildFormArgument,
    defaultValues: BuildFormDefaultValues = {}
  ) {
    for (const name of Object.keys(obj)) {
      formErrors[name] = ''

      const field = obj[name]
      if (field && field.MESSAGES) validationMessages[name] = field.MESSAGES

      const defaultValue = defaultValues[name] || ''

      if (field && field.VALIDATORS) form.addControl(name, new FormControl(defaultValue, field.VALIDATORS))
      else form.addControl(name, new FormControl(defaultValue))
    }
  }

}
