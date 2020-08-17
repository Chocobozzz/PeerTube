import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'

export const VIDEO_CHANNEL_NAME_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required,
    Validators.minLength(1),
    Validators.maxLength(50),
    Validators.pattern(/^[a-z0-9][a-z0-9._]*$/)
  ],
  MESSAGES: {
    'required': $localize`Name is required.`,
    'minlength': $localize`Name must be at least 1 character long.`,
    'maxlength': $localize`Name cannot be more than 50 characters long.`,
    'pattern': $localize`Name should be lowercase alphanumeric; dots and underscores are allowed.`
  }
}

export const VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required,
    Validators.minLength(1),
    Validators.maxLength(50)
  ],
  MESSAGES: {
    'required': $localize`Display name is required.`,
    'minlength': $localize`Display name must be at least 1 character long.`,
    'maxlength': $localize`Display name cannot be more than 50 characters long.`
  }
}

export const VIDEO_CHANNEL_DESCRIPTION_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.minLength(3),
    Validators.maxLength(1000)
  ],
  MESSAGES: {
    'minlength': $localize`Description must be at least 3 characters long.`,
    'maxlength': $localize`Description cannot be more than 1000 characters long.`
  }
}

export const VIDEO_CHANNEL_SUPPORT_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.minLength(3),
    Validators.maxLength(1000)
  ],
  MESSAGES: {
    'minlength': $localize`Support text must be at least 3 characters long.`,
    'maxlength': $localize`Support text cannot be more than 1000 characters long`
  }
}
