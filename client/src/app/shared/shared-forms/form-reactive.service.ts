import { Injectable, inject } from '@angular/core'
import { AbstractControl, FormGroup, StatusChangeEvent } from '@angular/forms'
import { filter, firstValueFrom } from 'rxjs'
import { BuildFormArgument, BuildFormDefaultValues } from '../form-validators/form-validator.model'
import { FormValidatorService } from './form-validator.service'

export type FormReactiveErrors = { [id: string]: string | FormReactiveErrors | FormReactiveErrors[] }
export type FormReactiveValidationMessages = {
  [id: string]: { [name: string]: string } | FormReactiveValidationMessages | FormReactiveValidationMessages[]
}

@Injectable()
export class FormReactiveService {
  private formValidatorService = inject(FormValidatorService)

  buildForm<T = any> (obj: BuildFormArgument, defaultValues: BuildFormDefaultValues = {}) {
    const { formErrors, validationMessages, form } = this.formValidatorService.internalBuildForm<T>(obj, defaultValues)

    form.events
      .pipe(filter(e => e instanceof StatusChangeEvent))
      .subscribe(() => this.onStatusChanged({ form, formErrors, validationMessages }))

    return { form, formErrors, validationMessages }
  }

  waitPendingCheck (form: FormGroup) {
    if (form.status !== 'PENDING') return

    return firstValueFrom(form.events.pipe(filter(e => e instanceof StatusChangeEvent && e.status !== 'PENDING')))
  }

  markAllAsDirty (controlsArg: { [key: string]: AbstractControl }) {
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

  grabAllErrors (errorObjectArg: FormReactiveErrors | FormReactiveErrors[]) {
    let acc: string[] = []

    if (Array.isArray(errorObjectArg)) {
      for (const errorObject of errorObjectArg) {
        acc = acc.concat(this.grabAllErrors(errorObject))
      }

      return acc
    }

    for (const key of Object.keys(errorObjectArg)) {
      const value = errorObjectArg[key]
      if (!value) continue

      if (typeof value === 'string') {
        acc.push(value)
      } else {
        acc = acc.concat(this.grabAllErrors(value))
      }
    }

    return acc
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
