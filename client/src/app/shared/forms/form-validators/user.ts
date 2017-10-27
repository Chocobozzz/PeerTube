import { Validators } from '@angular/forms'

export const USER_USERNAME = {
  VALIDATORS: [ Validators.required, Validators.minLength(3), Validators.maxLength(20) ],
  MESSAGES: {
    'required': 'Username is required.',
    'minlength': 'Username must be at least 3 characters long.',
    'maxlength': 'Username cannot be more than 20 characters long.'
  }
}
export const USER_EMAIL = {
  VALIDATORS: [ Validators.required, Validators.email ],
  MESSAGES: {
    'required': 'Email is required.',
    'email': 'Email must be valid.'
  }
}
export const USER_PASSWORD = {
  VALIDATORS: [ Validators.required, Validators.minLength(6) ],
  MESSAGES: {
    'required': 'Password is required.',
    'minlength': 'Password must be at least 6 characters long.'
  }
}
export const USER_VIDEO_QUOTA = {
  VALIDATORS: [ Validators.required, Validators.min(-1) ],
  MESSAGES: {
    'required': 'Video quota is required.',
    'min': 'Quota must be greater than -1.'
  }
}
export const USER_ROLE = {
  VALIDATORS: [ Validators.required ],
  MESSAGES: {
    'required': 'User role is required.',
  }
}
