
import { AbstractControl, FormGroup } from '@angular/forms'
import { wait } from '@root-helpers/utils'
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

    this.form.statusChanges.subscribe(async () => {
      // FIXME: remove when https://github.com/angular/angular/issues/41519 is fixed
      await this.waitPendingCheck()

      this.onStatusChanged(this.form, this.formErrors, this.validationMessages)
    })
  }

  protected async waitPendingCheck () {
    if (this.form.status !== 'PENDING') return

    // FIXME: the following line does not work: https://github.com/angular/angular/issues/41519
    // return firstValueFrom(this.form.statusChanges.pipe(filter(status => status !== 'PENDING')))
    // So we have to fallback to active wait :/

    do {
      await wait(10)
    } while (this.form.status === 'PENDING')
  }

  protected markAllAsDirty (controlsArg?: { [ key: string ]: AbstractControl }) {
    const controls = controlsArg || this.form.controls

    for (const key of Object.keys(controls)) {
      const control = controls[key]

      if (control instanceof FormGroup) {
        this.markAllAsDirty(control.controls)
        continue
      }

      control.markAsDirty()
    }
  }

  protected forceCheck () {
    this.onStatusChanged(this.form, this.formErrors, this.validationMessages, false)
  }

  private onStatusChanged (
    form: FormGroup,
    formErrors: FormReactiveErrors,
    validationMessages: FormReactiveValidationMessages,
    onlyDirty = true
  ) {
    for (const field of Object.keys(formErrors)) {
      if (formErrors[field] && typeof formErrors[field] === 'object') {
        this.onStatusChanged(
          form.controls[field] as FormGroup,
          formErrors[field] as FormReactiveErrors,
          validationMessages[field] as FormReactiveValidationMessages,
          onlyDirty
        )
        continue
      }

      // clear previous error message (if any)
      formErrors[field] = ''
      const control = form.get(field)

      if (control.dirty) this.formChanged = true

      if (!control || (onlyDirty && !control.dirty) || !control.enabled || !control.errors) continue

      const staticMessages = validationMessages[field]
      for (const key of Object.keys(control.errors)) {
        const formErrorValue = control.errors[key]

        // Try to find error message in static validation messages first
        // Then check if the validator returns a string that is the error
        if (staticMessages[key]) formErrors[field] += staticMessages[key] + ' '
        else if (typeof formErrorValue === 'string') formErrors[field] += control.errors[key]
        else throw new Error('Form error value of ' + field + ' is invalid')
      }
    }
  }
}
