import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'

export const REQUIRED_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required ],
  MESSAGES: {
    required: $localize`This field is required.`
  }
}

export const URL_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.pattern(/^https:\/\//) ],
  MESSAGES: {
    pattern: $localize`This field must be a URL`
  }
}
