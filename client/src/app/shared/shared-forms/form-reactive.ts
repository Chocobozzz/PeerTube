import { FormGroup } from '@angular/forms'
import { BuildFormArgument, BuildFormDefaultValues } from '../form-validators/form-validator.model'
import { FormReactiveService, FormReactiveValidationMessages } from './form-reactive.service'

export abstract class FormReactive {
  protected abstract formReactiveService: FormReactiveService
  protected formChanged = false

  form: FormGroup
  formErrors: any // To avoid casting in template because of string | FormReactiveErrors
  validationMessages: FormReactiveValidationMessages

  buildForm (obj: BuildFormArgument, defaultValues: BuildFormDefaultValues = {}) {
    const { formErrors, validationMessages, form } = this.formReactiveService.buildForm(obj, defaultValues)

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages
  }

  protected async waitPendingCheck () {
    return this.formReactiveService.waitPendingCheck(this.form)
  }

  protected markAllAsDirty () {
    return this.formReactiveService.markAllAsDirty(this.form.controls)
  }

  protected forceCheck () {
    return this.formReactiveService.forceCheck(this.form, this.formErrors, this.validationMessages)
  }
}
