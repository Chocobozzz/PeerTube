import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'

export const FROM_EMAIL_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [Validators.required, Validators.email],
  MESSAGES: {
    'required': $localize`Email is required.`,
    'email': $localize`Email must be valid.`
  }
}

export const FROM_NAME_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required,
    Validators.minLength(1),
    Validators.maxLength(120)
  ],
  MESSAGES: {
    'required': $localize`Your name is required.`,
    'minlength': $localize`Your name must be at least 1 character long.`,
    'maxlength': $localize`Your name cannot be more than 120 characters long.`
  }
}

export const SUBJECT_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required,
    Validators.minLength(1),
    Validators.maxLength(120)
  ],
  MESSAGES: {
    'required': $localize`A subject is required.`,
    'minlength': $localize`The subject must be at least 1 character long.`,
    'maxlength': $localize`The subject cannot be more than 120 characters long.`
  }
}

export const BODY_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required,
    Validators.minLength(3),
    Validators.maxLength(5000)
  ],
  MESSAGES: {
    'required': $localize`A message is required.`,
    'minlength': $localize`The message must be at least 3 characters long.`,
    'maxlength': $localize`The message cannot be more than 5000 characters long.`
  }
}
