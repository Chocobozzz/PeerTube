import { Validators } from '@angular/forms'

export const VIDEO_CHANNEL_DISPLAY_NAME = {
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
export const VIDEO_CHANNEL_DESCRIPTION = {
  VALIDATORS: [
    Validators.minLength(3),
    Validators.maxLength(500)
  ],
  MESSAGES: {
    'minlength': 'Description must be at least 3 characters long.',
    'maxlength': 'Description cannot be more than 500 characters long.'
  }
}
export const VIDEO_CHANNEL_SUPPORT = {
  VALIDATORS: [
    Validators.minLength(3),
    Validators.maxLength(500)
  ],
  MESSAGES: {
    'minlength': 'Support text must be at least 3 characters long.',
    'maxlength': 'Support text cannot be more than 500 characters long.'
  }
}
