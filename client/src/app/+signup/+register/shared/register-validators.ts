import { Validators } from '@angular/forms'
import { BuildFormValidator } from '@app/shared/form-validators/form-validator.model'

export const REGISTER_TERMS_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.requiredTrue ],
  MESSAGES: {
    required: $localize`You must agree with the platform terms in order to register on it.`
  }
}

export const REGISTER_REASON_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.minLength(2), Validators.maxLength(3000) ],
  MESSAGES: {
    required: $localize`Registration reason is required.`,
    minlength: $localize`Registration reason must be at least 2 characters long.`,
    maxlength: $localize`Registration reason cannot be more than 3000 characters long.`
  }
}
