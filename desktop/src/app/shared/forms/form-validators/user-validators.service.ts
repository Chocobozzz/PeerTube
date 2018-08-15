import { I18n } from '@ngx-translate/i18n-polyfill'
import { Validators } from '@angular/forms'
import { BuildFormValidator } from '@app/shared'
import { Injectable } from '@angular/core'

@Injectable()
export class UserValidatorsService {
  readonly USER_USERNAME: BuildFormValidator
  readonly USER_EMAIL: BuildFormValidator
  readonly USER_PASSWORD: BuildFormValidator
  readonly USER_VIDEO_QUOTA: BuildFormValidator
  readonly USER_ROLE: BuildFormValidator
  readonly USER_DISPLAY_NAME: BuildFormValidator
  readonly USER_DESCRIPTION: BuildFormValidator
  readonly USER_TERMS: BuildFormValidator

  readonly USER_BAN_REASON: BuildFormValidator

  constructor (private i18n: I18n) {

    this.USER_USERNAME = {
      VALIDATORS: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(20),
        Validators.pattern(/^[a-z0-9._]+$/)
      ],
      MESSAGES: {
        'required': this.i18n('Username is required.'),
        'minlength': this.i18n('Username must be at least 3 characters long.'),
        'maxlength': this.i18n('Username cannot be more than 20 characters long.'),
        'pattern': this.i18n('Username should be only lowercase alphanumeric characters.')
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

    this.USER_VIDEO_QUOTA = {
      VALIDATORS: [ Validators.required, Validators.min(-1) ],
      MESSAGES: {
        'required': this.i18n('Video quota is required.'),
        'min': this.i18n('Quota must be greater than -1.')
      }
    }

    this.USER_ROLE = {
      VALIDATORS: [ Validators.required ],
      MESSAGES: {
        'required': this.i18n('User role is required.')
      }
    }

    this.USER_DISPLAY_NAME = {
      VALIDATORS: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(120)
      ],
      MESSAGES: {
        'required': this.i18n('Display name is required.'),
        'minlength': this.i18n('Display name must be at least 3 characters long.'),
        'maxlength': this.i18n('Display name cannot be more than 120 characters long.')
      }
    }

    this.USER_DESCRIPTION = {
      VALIDATORS: [
        Validators.minLength(3),
        Validators.maxLength(250)
      ],
      MESSAGES: {
        'minlength': this.i18n('Description must be at least 3 characters long.'),
        'maxlength': this.i18n('Description cannot be more than 250 characters long.')
      }
    }

    this.USER_TERMS = {
      VALIDATORS: [
        Validators.requiredTrue
      ],
      MESSAGES: {
        'required': this.i18n('You must to agree with the instance terms in order to registering on it.')
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
}
