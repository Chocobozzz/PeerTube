import { FormGroup } from '@angular/forms'
import { BuildFormArgument, FormDefault } from '../form-validators/form-validator.model'
import { FormReactiveService, FormReactiveMessages } from './form-reactive.service'

export abstract class FormReactive {
  protected abstract formReactiveService: FormReactiveService
  protected formChanged = false

  form: FormGroup
  formErrors: any // To avoid casting in template because of string | FormReactiveErrors
  validationMessages: FormReactiveMessages

  buildForm (obj: BuildFormArgument, defaultValues: FormDefault = {}) {
    const { formErrors, validationMessages, form } = this.formReactiveService.buildForm(obj, defaultValues)

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages
  }

  protected markAllAsDirty () {
    return this.formReactiveService.markAllAsDirty(this.form.controls)
  }

  protected forceCheck () {
    return this.formReactiveService.forceCheck(this.form, this.formErrors, this.validationMessages)
  }
}
