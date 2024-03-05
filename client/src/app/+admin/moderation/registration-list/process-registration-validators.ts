import { Validators } from '@angular/forms'
import { BuildFormValidator } from '@app/shared/form-validators/form-validator.model'

export const REGISTRATION_MODERATION_RESPONSE_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.minLength(2), Validators.maxLength(3000) ],
  MESSAGES: {
    required: $localize`Moderation response is required.`,
    minlength: $localize`Moderation response must be at least 2 characters long.`,
    maxlength: $localize`Moderation response cannot be more than 3000 characters long.`
  }
}
