import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'

export const REQUIRED_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required ],
  MESSAGES: {
    required: $localize`This field is required.`
  }
}

export const URL_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.pattern(/^https?:\/\//) ],
  MESSAGES: {
    pattern: $localize`This field must be a URL`
  }
}

export const HEX_COLOR_CODE_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.pattern(/^#[A-Fa-f0-9]{6}$/) ],
  MESSAGES: {
    required: $localize`This field is required.`,
    pattern: $localize`This field must be a valid 6-digit hexadecimal color code.`
  }
}
