import { Injectable } from '@angular/core'
import { AbstractControl, FormGroup } from '@angular/forms'
import { wait } from '@root-helpers/utils'
import { BuildFormArgument, BuildFormDefaultValues } from '../form-validators/form-validator.model'
import { FormValidatorService } from './form-validator.service'

export type FormReactiveErrors = { [ id: string ]: string | FormReactiveErrors | FormReactiveErrors[] }
export type FormReactiveValidationMessages = {
  [ id: string ]: { [ name: string ]: string } | FormReactiveValidationMessages | FormReactiveValidationMessages[]
}

@Injectable()
export class FormReactiveService {

  constructor (private formValidatorService: FormValidatorService) {

  }

  buildForm (obj: BuildFormArgument, defaultValues: BuildFormDefaultValues = {}) {
    const { formErrors, validationMessages, form } = this.formValidatorService.buildForm(obj, defaultValues)

    form.statusChanges.subscribe(async () => {
      // FIXME: remove when https://github.com/angular/angular/issues/41519 is fixed
      await this.waitPendingCheck(form)

      this.onStatusChanged({ form, formErrors, validationMessages })
    })

    return { form, formErrors, validationMessages }
  }

  async waitPendingCheck (form: FormGroup) {
    if (form.status !== 'PENDING') return

    // FIXME: the following line does not work: https://github.com/angular/angular/issues/41519
    // return firstValueFrom(form.statusChanges.pipe(filter(status => status !== 'PENDING')))
    // So we have to fallback to active wait :/

    do {
      await wait(10)
    } while (form.status === 'PENDING')
  }

  markAllAsDirty (controlsArg: { [ key: string ]: AbstractControl }) {
    const controls = controlsArg

    for (const key of Object.keys(controls)) {
      const control = controls[key]

      if (control instanceof FormGroup) {
        this.markAllAsDirty(control.controls)
        continue
      }

      control.markAsDirty()
    }
  }

  forceCheck (form: FormGroup, formErrors: any, validationMessages: FormReactiveValidationMessages) {
    this.onStatusChanged({ form, formErrors, validationMessages, onlyDirty: false })
  }

  private onStatusChanged (options: {
    form: FormGroup
    formErrors: FormReactiveErrors
    validationMessages: FormReactiveValidationMessages
    onlyDirty?: boolean // default true
  }) {
    const { form, formErrors, validationMessages, onlyDirty = true } = options

    for (const field of Object.keys(formErrors)) {
      if (formErrors[field] && typeof formErrors[field] === 'object') {
        this.onStatusChanged({
          form: form.controls[field] as FormGroup,
          formErrors: formErrors[field] as FormReactiveErrors,
          validationMessages: validationMessages[field] as FormReactiveValidationMessages,
          onlyDirty
        })

        continue
      }

      // clear previous error message (if any)
      formErrors[field] = ''
      const control = form.get(field)

      if (!control || (onlyDirty && !control.dirty) || !control.enabled || !control.errors) continue

      const staticMessages = validationMessages[field] as FormReactiveValidationMessages
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
