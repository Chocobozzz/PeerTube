import { FormGroup } from '@angular/forms'
import { BuildFormArgument, BuildFormDefaultValues, FormValidatorService } from './form-validators'

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
      formErrors[ field ] = ''
      const control = form.get(field)

      if (control.dirty) this.formChanged = true

      // Don't care if dirty on force check
      const isDirty = control.dirty || forceCheck === true
      if (control && isDirty && control.enabled && !control.valid) {
        const messages = validationMessages[ field ]
        for (const key of Object.keys(control.errors)) {
          formErrors[ field ] += messages[ key ] + ' '
        }
      }
    }
  }

}
