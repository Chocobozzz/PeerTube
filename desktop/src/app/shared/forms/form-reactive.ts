import { FormGroup } from '@angular/forms'
import { BuildFormArgument, BuildFormDefaultValues, FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'

export type FormReactiveErrors = { [ id: string ]: string }
export type FormReactiveValidationMessages = {
  [ id: string ]: {
    [ name: string ]: string
  }
}

export abstract class FormReactive {
  protected abstract formValidatorService: FormValidatorService
  protected formChanged = false

  form: FormGroup
  formErrors: FormReactiveErrors
  validationMessages: FormReactiveValidationMessages

  buildForm (obj: BuildFormArgument, defaultValues: BuildFormDefaultValues = {}) {
    const { formErrors, validationMessages, form } = this.formValidatorService.buildForm(obj, defaultValues)

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages

    this.form.valueChanges.subscribe(() => this.onValueChanged(false))
  }

  protected onValueChanged (forceCheck = false) {
    for (const field in this.formErrors) {
      // clear previous error message (if any)
      this.formErrors[ field ] = ''
      const control = this.form.get(field)

      if (control.dirty) this.formChanged = true

      // Don't care if dirty on force check
      const isDirty = control.dirty || forceCheck === true
      if (control && isDirty && !control.valid) {
        const messages = this.validationMessages[ field ]
        for (const key in control.errors) {
          this.formErrors[ field ] += messages[ key ] + ' '
        }
      }
    }
  }

  protected forceCheck () {
    return this.onValueChanged(true)
  }
}
