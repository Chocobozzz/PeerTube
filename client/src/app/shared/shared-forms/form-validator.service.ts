import { Injectable, inject } from '@angular/core'
import { AsyncValidatorFn, FormArray, FormBuilder, FormControl, FormGroup, ValidatorFn } from '@angular/forms'
import { objectKeysTyped } from '@peertube/peertube-core-utils'
import { BuildFormArgument, FormDefault } from '../form-validators/form-validator.model'
import { FormReactiveErrors, FormReactiveMessages } from './form-reactive.service'

@Injectable()
export class FormValidatorService {
  private formBuilder = inject(FormBuilder)

  internalBuildForm<T = any> (obj: BuildFormArgument, defaultValues: FormDefault = {}) {
    const formErrors: FormReactiveErrors = {}
    const validationMessages: FormReactiveMessages = {}
    const group: { [key: string]: any } = {}

    for (const name of Object.keys(obj)) {
      formErrors[name] = ''

      const field = obj[name]
      if (this.isRecursiveField(field)) {
        const result = this.internalBuildForm(field as BuildFormArgument, defaultValues[name] as FormDefault)
        group[name] = result.form
        formErrors[name] = result.formErrors
        validationMessages[name] = result.validationMessages

        continue
      }

      if (field?.MESSAGES) validationMessages[name] = field.MESSAGES as { [name: string]: string }

      const defaultValue = defaultValues[name] !== undefined
        ? defaultValues[name]
        : ''

      if (field?.VALIDATORS) group[name] = [ defaultValue, field.VALIDATORS ]
      else group[name] = [ defaultValue ]
    }

    const form = this.formBuilder.group<T>(group as any)
    return { form, formErrors, validationMessages }
  }

  updateFormGroup (
    form: FormGroup,
    formErrors: FormReactiveErrors,
    validationMessages: FormReactiveMessages,
    formToBuild: BuildFormArgument,
    defaultValues: FormDefault = {}
  ) {
    for (const name of objectKeysTyped(formToBuild)) {
      const field = formToBuild[name]

      if (this.isRecursiveField(field)) {
        formErrors[name] = {}

        this.updateFormGroup(
          // FIXME: typings
          (form as any)[name],
          formErrors[name],
          validationMessages[name] as FormReactiveMessages,
          formToBuild[name] as BuildFormArgument,
          defaultValues[name] as FormDefault
        )
        continue
      }

      formErrors[name] = ''

      if (field?.MESSAGES) validationMessages[name] = field.MESSAGES as { [name: string]: string }

      const defaultValue = defaultValues[name] ?? ''

      form.addControl(
        name + '',
        new FormControl(defaultValue, field?.VALIDATORS as ValidatorFn[], field?.ASYNC_VALIDATORS as AsyncValidatorFn[])
      )
    }
  }

  addControlInFormArray (options: {
    formErrors: FormReactiveErrors
    validationMessages: FormReactiveMessages
    formArray: FormArray
    controlName: string
    formToBuild: BuildFormArgument
    defaultValues?: FormDefault
  }) {
    const { formArray, formErrors, validationMessages, controlName, formToBuild, defaultValues = {} } = options

    const formGroup = new FormGroup({})
    if (!formErrors[controlName]) formErrors[controlName] = [] as FormReactiveErrors[]
    if (!validationMessages[controlName]) validationMessages[controlName] = []

    const formArrayErrors = formErrors[controlName] as FormReactiveErrors[]
    const formArrayValidationMessages = validationMessages[controlName] as FormReactiveMessages[]

    const totalControls = formArray.controls.length
    formArrayErrors.push({})
    formArrayValidationMessages.push({})

    this.updateFormGroup(
      formGroup,
      formArrayErrors[totalControls],
      formArrayValidationMessages[totalControls],
      formToBuild,
      defaultValues
    )

    formArray.push(formGroup)
  }

  removeControlFromFormArray (options: {
    formErrors: FormReactiveErrors
    validationMessages: FormReactiveMessages
    index: number
    formArray: FormArray
    controlName: string
  }) {
    const { formArray, formErrors, validationMessages, index, controlName } = options

    const formArrayErrors = formErrors[controlName] as FormReactiveErrors[]
    const formArrayValidationMessages = validationMessages[controlName] as FormReactiveMessages[]

    formArrayErrors.splice(index, 1)
    formArrayValidationMessages.splice(index, 1)
    formArray.removeAt(index)
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
