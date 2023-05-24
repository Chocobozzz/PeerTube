import { Injectable } from '@angular/core'
import { AsyncValidatorFn, FormArray, FormBuilder, FormControl, FormGroup, ValidatorFn } from '@angular/forms'
import { objectKeysTyped } from '@shared/core-utils'
import { BuildFormArgument, BuildFormDefaultValues } from '../form-validators/form-validator.model'
import { FormReactiveErrors, FormReactiveValidationMessages } from './form-reactive.service'

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

      if (field?.MESSAGES) validationMessages[name] = field.MESSAGES as { [ name: string ]: string }

      const defaultValue = defaultValues[name] ?? ''

      if (field?.VALIDATORS) group[name] = [ defaultValue, field.VALIDATORS ]
      else group[name] = [ defaultValue ]
    }

    const form = this.formBuilder.group(group)
    return { form, formErrors, validationMessages }
  }

  updateFormGroup (
    form: FormGroup,
    formErrors: FormReactiveErrors,
    validationMessages: FormReactiveValidationMessages,
    obj: BuildFormArgument,
    defaultValues: BuildFormDefaultValues = {}
  ) {
    for (const name of objectKeysTyped(obj)) {
      formErrors[name] = ''

      const field = obj[name]
      if (this.isRecursiveField(field)) {
        this.updateFormGroup(
          // FIXME: typings
          (form as any)[name],
          formErrors[name] as FormReactiveErrors,
          validationMessages[name] as FormReactiveValidationMessages,
          obj[name] as BuildFormArgument,
          defaultValues[name] as BuildFormDefaultValues
        )
        continue
      }

      if (field?.MESSAGES) validationMessages[name] = field.MESSAGES as { [ name: string ]: string }

      const defaultValue = defaultValues[name] || ''

      form.addControl(
        name + '',
        new FormControl(defaultValue, field?.VALIDATORS as ValidatorFn[], field?.ASYNC_VALIDATORS as AsyncValidatorFn[])
      )
    }
  }

  updateTreeValidity (group: FormGroup | FormArray): void {
    for (const key of Object.keys(group.controls)) {
      // FIXME: typings
      const abstractControl = (group.controls as any)[key] as FormControl

      if (abstractControl instanceof FormGroup || abstractControl instanceof FormArray) {
        this.updateTreeValidity(abstractControl)
      } else {
        abstractControl.updateValueAndValidity({ emitEvent: false })
      }
    }
  }

  private isRecursiveField (field: any) {
    return field && typeof field === 'object' && !field.MESSAGES && !field.VALIDATORS
  }
}
