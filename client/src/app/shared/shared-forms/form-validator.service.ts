import { Injectable } from '@angular/core'
import { AsyncValidatorFn, FormArray, FormBuilder, FormControl, FormGroup, ValidatorFn } from '@angular/forms'
import { objectKeysTyped } from '@peertube/peertube-core-utils'
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
    formToBuild: BuildFormArgument,
    defaultValues: BuildFormDefaultValues = {}
  ) {
    for (const name of objectKeysTyped(formToBuild)) {
      if (typeof formErrors[name] === 'string') {
        formErrors[name] = ''
      }

      const field = formToBuild[name]
      if (this.isRecursiveField(field)) {
        this.updateFormGroup(
          // FIXME: typings
          (form as any)[name],
          formErrors[name] as FormReactiveErrors,
          validationMessages[name] as FormReactiveValidationMessages,
          formToBuild[name] as BuildFormArgument,
          defaultValues[name] as BuildFormDefaultValues
        )
        continue
      }

      if (field?.MESSAGES) validationMessages[name] = field.MESSAGES as { [ name: string ]: string }

      const defaultValue = defaultValues[name] ?? ''

      form.addControl(
        name + '',
        new FormControl(defaultValue, field?.VALIDATORS as ValidatorFn[], field?.ASYNC_VALIDATORS as AsyncValidatorFn[])
      )
    }
  }

  addControlInFormArray (options: {
    formErrors: FormReactiveErrors
    validationMessages: FormReactiveValidationMessages
    formArray: FormArray
    controlName: string
    formToBuild: BuildFormArgument
    defaultValues?: BuildFormDefaultValues
  }) {
    const { formArray, formErrors, validationMessages, controlName, formToBuild, defaultValues = {} } = options

    const formGroup = new FormGroup({})
    if (!formErrors[controlName]) formErrors[controlName] = [] as FormReactiveErrors[]
    if (!validationMessages[controlName]) validationMessages[controlName] = []

    const formArrayErrors = formErrors[controlName] as FormReactiveErrors[]
    const formArrayValidationMessages = validationMessages[controlName] as FormReactiveValidationMessages[]

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
    validationMessages: FormReactiveValidationMessages
    index: number
    formArray: FormArray
    controlName: string
  }) {
    const { formArray, formErrors, validationMessages, index, controlName } = options

    const formArrayErrors = formErrors[controlName] as FormReactiveErrors[]
    const formArrayValidationMessages = validationMessages[controlName] as FormReactiveValidationMessages[]

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
