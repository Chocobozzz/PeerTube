import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'

export const USER_USERNAME_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required,
    Validators.minLength(1),
    Validators.maxLength(50),
    Validators.pattern(/^[a-z0-9][a-z0-9._]*$/)
  ],
  MESSAGES: {
    'required': $localize`Username is required.`,
    'minlength': $localize`Username must be at least 1 character long.`,
    'maxlength': $localize`Username cannot be more than 50 characters long.`,
    'pattern': $localize`Username should be lowercase alphanumeric; dots and underscores are allowed.`
  }
}

export const USER_CHANNEL_NAME_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required,
    Validators.minLength(1),
    Validators.maxLength(50),
    Validators.pattern(/^[a-z0-9][a-z0-9._]*$/)
  ],
  MESSAGES: {
    'required': $localize`Channel name is required.`,
    'minlength': $localize`Channel name must be at least 1 character long.`,
    'maxlength': $localize`Channel name cannot be more than 50 characters long.`,
    'pattern': $localize`Channel name should be lowercase, and can contain only alphanumeric characters, dots and underscores.`
  }
}

export const USER_EMAIL_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.email ],
  MESSAGES: {
    'required': $localize`Email is required.`,
    'email': $localize`Email must be valid.`
  }
}

export const USER_HANDLE_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required,
    Validators.pattern(/@.+/)
  ],
  MESSAGES: {
    'required': $localize`Handle is required.`,
    'pattern': $localize`Handle must be valid (chocobozzz@example.com).`
  }
}

export const USER_EXISTING_PASSWORD_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required
  ],
  MESSAGES: {
    'required': $localize`Password is required.`
  }
}

export const USER_PASSWORD_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required,
    Validators.minLength(6),
    Validators.maxLength(255)
  ],
  MESSAGES: {
    'required': $localize`Password is required.`,
    'minlength': $localize`Password must be at least 6 characters long.`,
    'maxlength': $localize`Password cannot be more than 255 characters long.`
  }
}

export const USER_PASSWORD_OPTIONAL_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.minLength(6),
    Validators.maxLength(255)
  ],
  MESSAGES: {
    'minlength': $localize`Password must be at least 6 characters long.`,
    'maxlength': $localize`Password cannot be more than 255 characters long.`
  }
}

export const USER_CONFIRM_PASSWORD_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [],
  MESSAGES: {
    'matchPassword': $localize`The new password and the confirmed password do not correspond.`
  }
}

export const USER_VIDEO_QUOTA_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.min(-1) ],
  MESSAGES: {
    'required': $localize`Video quota is required.`,
    'min': $localize`Quota must be greater than -1.`
  }
}
export const USER_VIDEO_QUOTA_DAILY_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.min(-1) ],
  MESSAGES: {
    'required': $localize`Daily upload limit is required.`,
    'min': $localize`Daily upload limit must be greater than -1.`
  }
}

export const USER_ROLE_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required ],
  MESSAGES: {
    'required': $localize`User role is required.`
  }
}

export const USER_DISPLAY_NAME_REQUIRED_VALIDATOR = buildDisplayNameValidator(true)

export const USER_DESCRIPTION_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.minLength(3),
    Validators.maxLength(1000)
  ],
  MESSAGES: {
    'minlength': $localize`Description must be at least 3 characters long.`,
    'maxlength': $localize`Description cannot be more than 1000 characters long.`
  }
}

export const USER_TERMS_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.requiredTrue ],
  MESSAGES: {
    'required': $localize`You must agree with the instance terms in order to register on it.`
  }
}

export const USER_BAN_REASON_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.minLength(3),
    Validators.maxLength(250)
  ],
  MESSAGES: {
    'minlength': $localize`Ban reason must be at least 3 characters long.`,
    'maxlength': $localize`Ban reason cannot be more than 250 characters long.`
  }
}

function buildDisplayNameValidator (required: boolean) {
  const control = {
    VALIDATORS: [
      Validators.minLength(1),
      Validators.maxLength(120)
    ],
    MESSAGES: {
      'required': $localize`Display name is required.`,
      'minlength': $localize`Display name must be at least 1 character long.`,
      'maxlength': $localize`Display name cannot be more than 50 characters long.`
    }
  }

  if (required) control.VALIDATORS.push(Validators.required)

  return control
}
