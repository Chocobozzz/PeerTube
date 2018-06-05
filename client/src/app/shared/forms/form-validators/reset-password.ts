import { Validators } from '@angular/forms'

export const RESET_PASSWORD_CONFIRM = {
  VALIDATORS: [
    Validators.required
  ],
  MESSAGES: {
    'required': 'Confirmation of the password is required.'
  }
}
