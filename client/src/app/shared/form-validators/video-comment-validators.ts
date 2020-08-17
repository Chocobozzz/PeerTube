import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'

export const VIDEO_COMMENT_TEXT_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.minLength(1), Validators.maxLength(3000) ],
  MESSAGES: {
    'required': $localize`Comment is required.`,
    'minlength': $localize`Comment must be at least 2 characters long.`,
    'maxlength': $localize`Comment cannot be more than 3000 characters long.`
  }
}
