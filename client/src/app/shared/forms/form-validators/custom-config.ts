import { Validators } from '@angular/forms'

export const INSTANCE_NAME = {
  VALIDATORS: [ Validators.required ],
  MESSAGES: {
    'required': 'Instance name is required.'
  }
}

export const INSTANCE_SHORT_DESCRIPTION = {
  VALIDATORS: [ Validators.max(250) ],
  MESSAGES: {
    'max': 'Short description should not be longer than 250 characters.'
  }
}

export const SERVICES_TWITTER_USERNAME = {
  VALIDATORS: [ Validators.required ],
  MESSAGES: {
    'required': 'Twitter username is required.'
  }
}

export const CACHE_PREVIEWS_SIZE = {
  VALIDATORS: [ Validators.required, Validators.min(1), Validators.pattern('[0-9]+') ],
  MESSAGES: {
    'required': 'Preview cache size is required.',
    'min': 'Preview cache size must be greater than 1.',
    'pattern': 'Preview cache size must be a number.'
  }
}

export const SIGNUP_LIMIT = {
  VALIDATORS: [ Validators.required, Validators.min(1), Validators.pattern('[0-9]+') ],
  MESSAGES: {
    'required': 'Signup limit is required.',
    'min': 'Signup limit must be greater than 1.',
    'pattern': 'Preview cache size must be a number.'
  }
}

export const ADMIN_EMAIL = {
  VALIDATORS: [ Validators.required, Validators.email ],
  MESSAGES: {
    'required': 'Admin email is required.',
    'email': 'Admin email must be valid.'
  }
}

export const TRANSCODING_THREADS = {
  VALIDATORS: [ Validators.required, Validators.min(1) ],
  MESSAGES: {
    'required': 'Transcoding threads is required.',
    'min': 'Transcoding threads must be greater than 1.'
  }
}
