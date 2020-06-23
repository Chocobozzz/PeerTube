import { I18n } from '@ngx-translate/i18n-polyfill'
import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.service'
import { Injectable } from '@angular/core'

@Injectable()
export class UserValidatorsService {
  readonly USER_USERNAME: BuildFormValidator
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

  constructor (private i18n: I18n) {

    this.USER_USERNAME = {
      VALIDATORS: [
        Validators.required,
        Validators.minLength(1),
        Validators.maxLength(50),
        Validators.pattern(/^[a-z0-9][a-z0-9._]*$/)
      ],
      MESSAGES: {
        'required': this.i18n('Username is required.'),
        'minlength': this.i18n('Username must be at least 1 character long.'),
        'maxlength': this.i18n('Username cannot be more than 50 characters long.'),
        'pattern': this.i18n('Username should be lowercase alphanumeric; dots and underscores are allowed.')
      }
    }

    this.USER_EMAIL = {
      VALIDATORS: [ Validators.required, Validators.email ],
      MESSAGES: {
        'required': this.i18n('Email is required.'),
        'email': this.i18n('Email must be valid.')
      }
    }

    this.USER_PASSWORD = {
      VALIDATORS: [
        Validators.required,
        Validators.minLength(6),
        Validators.maxLength(255)
      ],
      MESSAGES: {
        'required': this.i18n('Password is required.'),
        'minlength': this.i18n('Password must be at least 6 characters long.'),
        'maxlength': this.i18n('Password cannot be more than 255 characters long.')
      }
    }

    this.USER_PASSWORD_OPTIONAL = {
      VALIDATORS: [
        Validators.minLength(6),
        Validators.maxLength(255)
      ],
      MESSAGES: {
        'minlength': this.i18n('Password must be at least 6 characters long.'),
        'maxlength': this.i18n('Password cannot be more than 255 characters long.')
      }
    }

    this.USER_CONFIRM_PASSWORD = {
      VALIDATORS: [],
      MESSAGES: {
        'matchPassword': this.i18n('The new password and the confirmed password do not correspond.')
      }
    }

    this.USER_VIDEO_QUOTA = {
      VALIDATORS: [ Validators.required, Validators.min(-1) ],
      MESSAGES: {
        'required': this.i18n('Video quota is required.'),
        'min': this.i18n('Quota must be greater than -1.')
      }
    }
    this.USER_VIDEO_QUOTA_DAILY = {
      VALIDATORS: [ Validators.required, Validators.min(-1) ],
      MESSAGES: {
        'required': this.i18n('Daily upload limit is required.'),
        'min': this.i18n('Daily upload limit must be greater than -1.')
      }
    }

    this.USER_ROLE = {
      VALIDATORS: [ Validators.required ],
      MESSAGES: {
        'required': this.i18n('User role is required.')
      }
    }

    this.USER_DISPLAY_NAME_REQUIRED = this.getDisplayName(true)

    this.USER_DESCRIPTION = {
      VALIDATORS: [
        Validators.minLength(3),
        Validators.maxLength(1000)
      ],
      MESSAGES: {
        'minlength': this.i18n('Description must be at least 3 characters long.'),
        'maxlength': this.i18n('Description cannot be more than 1000 characters long.')
      }
    }

    this.USER_TERMS = {
      VALIDATORS: [
        Validators.requiredTrue
      ],
      MESSAGES: {
        'required': this.i18n('You must agree with the instance terms in order to register on it.')
      }
    }

    this.USER_BAN_REASON = {
      VALIDATORS: [
        Validators.minLength(3),
        Validators.maxLength(250)
      ],
      MESSAGES: {
        'minlength': this.i18n('Ban reason must be at least 3 characters long.'),
        'maxlength': this.i18n('Ban reason cannot be more than 250 characters long.')
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
        'required': this.i18n('Display name is required.'),
        'minlength': this.i18n('Display name must be at least 1 character long.'),
        'maxlength': this.i18n('Display name cannot be more than 50 characters long.')
      }
    }

    if (required) control.VALIDATORS.push(Validators.required)

    return control
  }
}
