import { Injectable } from '@angular/core'
import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.service'

@Injectable()
export class UserValidatorsService {
  readonly USER_USERNAME: BuildFormValidator
  readonly USER_CHANNEL_NAME: BuildFormValidator
  readonly USER_EMAIL: BuildFormValidator
  readonly USER_PASSWORD: BuildFormValidator
  readonly USER_PASSWORD_OPTIONAL: BuildFormValidator
  readonly USER_CONFIRM_PASSWORD: BuildFormValidator
  readonly USER_VIDEO_QUOTA: BuildFormValidator
  readonly USER_VIDEO_QUOTA_DAILY: BuildFormValidator
  readonly USER_ROLE: BuildFormValidator
  readonly USER_DISPLAY_NAME_REQUIRED: BuildFormValidator
  readonly USER_DESCRIPTION: BuildFormValidator
  readonly USER_TERMS: BuildFormValidator

  readonly USER_BAN_REASON: BuildFormValidator

  constructor () {

    this.USER_USERNAME = {
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

    this.USER_CHANNEL_NAME = {
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
        'pattern': $localize`Channel name should be lowercase alphanumeric; dots and underscores are allowed.`
      }
    }

    this.USER_EMAIL = {
      VALIDATORS: [ Validators.required, Validators.email ],
      MESSAGES: {
        'required': $localize`Email is required.`,
        'email': $localize`Email must be valid.`
      }
    }

    this.USER_PASSWORD = {
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

    this.USER_PASSWORD_OPTIONAL = {
      VALIDATORS: [
        Validators.minLength(6),
        Validators.maxLength(255)
      ],
      MESSAGES: {
        'minlength': $localize`Password must be at least 6 characters long.`,
        'maxlength': $localize`Password cannot be more than 255 characters long.`
      }
    }

    this.USER_CONFIRM_PASSWORD = {
      VALIDATORS: [],
      MESSAGES: {
        'matchPassword': $localize`The new password and the confirmed password do not correspond.`
      }
    }

    this.USER_VIDEO_QUOTA = {
      VALIDATORS: [ Validators.required, Validators.min(-1) ],
      MESSAGES: {
        'required': $localize`Video quota is required.`,
        'min': $localize`Quota must be greater than -1.`
      }
    }
    this.USER_VIDEO_QUOTA_DAILY = {
      VALIDATORS: [ Validators.required, Validators.min(-1) ],
      MESSAGES: {
        'required': $localize`Daily upload limit is required.`,
        'min': $localize`Daily upload limit must be greater than -1.`
      }
    }

    this.USER_ROLE = {
      VALIDATORS: [ Validators.required ],
      MESSAGES: {
        'required': $localize`User role is required.`
      }
    }

    this.USER_DISPLAY_NAME_REQUIRED = this.getDisplayName(true)

    this.USER_DESCRIPTION = {
      VALIDATORS: [
        Validators.minLength(3),
        Validators.maxLength(1000)
      ],
      MESSAGES: {
        'minlength': $localize`Description must be at least 3 characters long.`,
        'maxlength': $localize`Description cannot be more than 1000 characters long.`
      }
    }

    this.USER_TERMS = {
      VALIDATORS: [
        Validators.requiredTrue
      ],
      MESSAGES: {
        'required': $localize`You must agree with the instance terms in order to register on it.`
      }
    }

    this.USER_BAN_REASON = {
      VALIDATORS: [
        Validators.minLength(3),
        Validators.maxLength(250)
      ],
      MESSAGES: {
        'minlength': $localize`Ban reason must be at least 3 characters long.`,
        'maxlength': $localize`Ban reason cannot be more than 250 characters long.`
      }
    }
  }

  private getDisplayName (required: boolean) {
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
}
