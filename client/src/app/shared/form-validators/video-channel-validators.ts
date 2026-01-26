import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'
import { USER_USERNAME_VALIDATOR } from './user-validators'

export const VIDEO_CHANNEL_NAME_VALIDATOR: BuildFormValidator = {
  // Use the same constraints than user username
  VALIDATORS: USER_USERNAME_VALIDATOR.VALIDATORS,

  MESSAGES: {
    required: $localize`Name is required.`,
    minlength: $localize`Name must be at least 1 character long.`,
    maxlength: $localize`Name cannot be more than 50 characters long.`,
    pattern: $localize`Name should be lowercase alphanumeric; dots and underscores are allowed.`
  }
}

export const VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required,
    Validators.minLength(1),
    Validators.maxLength(50)
  ],
  MESSAGES: {
    required: $localize`Display name is required.`,
    minlength: $localize`Display name must be at least 1 character long.`,
    maxlength: $localize`Display name cannot be more than 50 characters long.`
  }
}

export const VIDEO_CHANNEL_DESCRIPTION_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.minLength(3),
    Validators.maxLength(1000)
  ],
  MESSAGES: {
    minlength: $localize`Description must be at least 3 characters long.`,
    maxlength: $localize`Description cannot be more than 1000 characters long.`
  }
}

export const VIDEO_CHANNEL_SUPPORT_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.minLength(3),
    Validators.maxLength(1000)
  ],
  MESSAGES: {
    minlength: $localize`Support text must be at least 3 characters long.`,
    maxlength: $localize`Support text cannot be more than 1000 characters long.`
  }
}

export const VIDEO_CHANNEL_EXTERNAL_URL_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required,
    Validators.pattern(/^https?:\/\//),
    Validators.maxLength(1000)
  ],
  MESSAGES: {
    required: $localize`Remote channel url is required.`,
    pattern: $localize`External channel URL must begin with "https://" or "http://"`,
    maxlength: $localize`External channel URL cannot be more than 1000 characters long`
  }
}
