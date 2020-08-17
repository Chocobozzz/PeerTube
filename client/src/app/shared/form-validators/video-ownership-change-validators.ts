import { AbstractControl, ValidationErrors, Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'

export const OWNERSHIP_CHANGE_CHANNEL_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required ],
  MESSAGES: {
    'required': $localize`The channel is required.`
  }
}

export const OWNERSHIP_CHANGE_USERNAME_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, localAccountValidator ],
  MESSAGES: {
    'required': $localize`The username is required.`,
    'localAccountOnly': $localize`You can only transfer ownership to a local account`
  }
}

function localAccountValidator (control: AbstractControl): ValidationErrors {
  if (control.value.includes('@')) {
    return { 'localAccountOnly': true }
  }

  return null
}
