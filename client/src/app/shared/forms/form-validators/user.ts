import { Validators } from '@angular/forms'

export const USER_USERNAME = {
  VALIDATORS: [
    Validators.required,
    Validators.minLength(3),
    Validators.maxLength(20),
    Validators.pattern(/^[a-z0-9._]+$/)
  ],
  MESSAGES: {
    'required': 'Username is required.',
    'minlength': 'Username must be at least 3 characters long.',
    'maxlength': 'Username cannot be more than 20 characters long.',
    'pattern': 'Username should be only lowercase alphanumeric characters.'
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
  VALIDATORS: [
    Validators.required,
    Validators.minLength(6),
    Validators.maxLength(255)
  ],
  MESSAGES: {
    'required': 'Password is required.',
    'minlength': 'Password must be at least 6 characters long.',
    'maxlength': 'Password cannot be more than 255 characters long.'
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
    'required': 'User role is required.'
  }
}
export const USER_DISPLAY_NAME = {
  VALIDATORS: [
    Validators.required,
    Validators.minLength(3),
    Validators.maxLength(120)
  ],
  MESSAGES: {
    'required': 'Display name is required.',
    'minlength': 'Display name must be at least 3 characters long.',
    'maxlength': 'Display name cannot be more than 120 characters long.'
  }
}
export const USER_DESCRIPTION = {
  VALIDATORS: [
    Validators.minLength(3),
    Validators.maxLength(250)
  ],
  MESSAGES: {
    'minlength': 'Description must be at least 3 characters long.',
    'maxlength': 'Description cannot be more than 250 characters long.'
  }
}
