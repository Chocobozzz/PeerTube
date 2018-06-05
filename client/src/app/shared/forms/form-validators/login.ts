import { Validators } from '@angular/forms'

export const LOGIN_USERNAME = {
  VALIDATORS: [
    Validators.required
  ],
  MESSAGES: {
    'required': 'Username is required.'
  }
}
export const LOGIN_PASSWORD = {
  VALIDATORS: [
    Validators.required
  ],
  MESSAGES: {
    'required': 'Password is required.'
  }
}
