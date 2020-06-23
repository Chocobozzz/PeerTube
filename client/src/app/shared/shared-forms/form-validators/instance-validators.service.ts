import { I18n } from '@ngx-translate/i18n-polyfill'
import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.service'
import { Injectable } from '@angular/core'

@Injectable()
export class InstanceValidatorsService {
  readonly FROM_EMAIL: BuildFormValidator
  readonly FROM_NAME: BuildFormValidator
  readonly SUBJECT: BuildFormValidator
  readonly BODY: BuildFormValidator

  constructor (private i18n: I18n) {

    this.FROM_EMAIL = {
      VALIDATORS: [ Validators.required, Validators.email ],
      MESSAGES: {
        'required': this.i18n('Email is required.'),
        'email': this.i18n('Email must be valid.')
      }
    }

    this.FROM_NAME = {
      VALIDATORS: [
        Validators.required,
        Validators.minLength(1),
        Validators.maxLength(120)
      ],
      MESSAGES: {
        'required': this.i18n('Your name is required.'),
        'minlength': this.i18n('Your name must be at least 1 character long.'),
        'maxlength': this.i18n('Your name cannot be more than 120 characters long.')
      }
    }

    this.SUBJECT = {
      VALIDATORS: [
        Validators.required,
        Validators.minLength(1),
        Validators.maxLength(120)
      ],
      MESSAGES: {
        'required': this.i18n('A subject is required.'),
        'minlength': this.i18n('The subject must be at least 1 character long.'),
        'maxlength': this.i18n('The subject cannot be more than 120 characters long.')
      }
    }

    this.BODY = {
      VALIDATORS: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(5000)
      ],
      MESSAGES: {
        'required': this.i18n('A message is required.'),
        'minlength': this.i18n('The message must be at least 3 characters long.'),
        'maxlength': this.i18n('The message cannot be more than 5000 characters long.')
      }
    }
  }
}
