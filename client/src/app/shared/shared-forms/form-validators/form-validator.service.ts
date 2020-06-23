import { FormBuilder, FormControl, FormGroup, ValidatorFn } from '@angular/forms'
import { Injectable } from '@angular/core'
import { FormReactiveErrors, FormReactiveValidationMessages } from '../form-reactive'

export type BuildFormValidator = {
  VALIDATORS: ValidatorFn[],
  MESSAGES: { [ name: string ]: string }
}
export type BuildFormArgument = {
  [ id: string ]: BuildFormValidator | BuildFormArgument
}
export type BuildFormDefaultValues = {
  [ name: string ]: string | string[] | BuildFormDefaultValues
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
      if (this.isRecursiveField(field)) {
        const result = this.buildForm(field as BuildFormArgument, defaultValues[name] as BuildFormDefaultValues)
        group[name] = result.form
        formErrors[name] = result.formErrors
        validationMessages[name] = result.validationMessages

        continue
      }

      if (field && field.MESSAGES) validationMessages[name] = field.MESSAGES as { [ name: string ]: string }

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
      if (this.isRecursiveField(field)) {
        this.updateForm(
          form[name],
          formErrors[name] as FormReactiveErrors,
          validationMessages[name] as FormReactiveValidationMessages,
          obj[name] as BuildFormArgument,
          defaultValues[name] as BuildFormDefaultValues
        )
        continue
      }

      if (field && field.MESSAGES) validationMessages[name] = field.MESSAGES as { [ name: string ]: string }

      const defaultValue = defaultValues[name] || ''

      if (field && field.VALIDATORS) form.addControl(name, new FormControl(defaultValue, field.VALIDATORS as ValidatorFn[]))
      else form.addControl(name, new FormControl(defaultValue))
    }
  }

  private isRecursiveField (field: any) {
    return field && typeof field === 'object' && !field.MESSAGES && !field.VALIDATORS
  }
}
