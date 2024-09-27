import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'

export const REQUIRED_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required ],
  MESSAGES: {
    required: $localize`This field is required.`
  }
}
