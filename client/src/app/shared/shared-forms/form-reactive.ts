import { FormGroup } from '@angular/forms'
import { BuildFormArgument, BuildFormDefaultValues } from '../form-validators/form-validator.model'
import { FormValidatorService } from './form-validator.service'

export type FormReactiveErrors = { [ id: string ]: string | FormReactiveErrors }
export type FormReactiveValidationMessages = {
  [ id: string ]: { [ name: string ]: string } | FormReactiveValidationMessages
}

export abstract class FormReactive {
  protected abstract formValidatorService: FormValidatorService
  protected formChanged = false

  form: FormGroup
  formErrors: any // To avoid casting in template because of string | FormReactiveErrors
  validationMessages: FormReactiveValidationMessages

  buildForm (obj: BuildFormArgument, defaultValues: BuildFormDefaultValues = {}) {
    const { formErrors, validationMessages, form } = this.formValidatorService.buildForm(obj, defaultValues)

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages

    this.form.valueChanges.subscribe(() => this.onValueChanged(this.form, this.formErrors, this.validationMessages, false))
  }

  protected forceCheck () {
    return this.onValueChanged(this.form, this.formErrors, this.validationMessages, true)
  }

  protected check () {
    return this.onValueChanged(this.form, this.formErrors, this.validationMessages, false)
  }

  private onValueChanged (
    form: FormGroup,
    formErrors: FormReactiveErrors,
    validationMessages: FormReactiveValidationMessages,
    forceCheck = false
  ) {
    for (const field of Object.keys(formErrors)) {
      if (formErrors[field] && typeof formErrors[field] === 'object') {
        this.onValueChanged(
          form.controls[field] as FormGroup,
          formErrors[field] as FormReactiveErrors,
          validationMessages[field] as FormReactiveValidationMessages,
          forceCheck
        )
        continue
      }

      // clear previous error message (if any)
      formErrors[field] = ''
      const control = form.get(field)

      if (control.dirty) this.formChanged = true

      if (forceCheck) control.updateValueAndValidity({ emitEvent: false })
      if (!control || !control.dirty || !control.enabled || control.valid) continue

      const staticMessages = validationMessages[field]
      for (const key of Object.keys(control.errors)) {
        const formErrorValue = control.errors[key]

        // Try to find error message in static validation messages first
        // Then check if the validator returns a string that is the error
        if (typeof formErrorValue === 'boolean') formErrors[field] += staticMessages[key] + ' '
        else if (typeof formErrorValue === 'string') formErrors[field] += control.errors[key]
        else throw new Error('Form error value of ' + field + ' is invalid')
      }
    }
  }

}
