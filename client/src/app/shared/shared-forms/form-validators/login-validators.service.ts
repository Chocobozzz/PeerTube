import { I18n } from '@ngx-translate/i18n-polyfill'
import { Validators } from '@angular/forms'
import { Injectable } from '@angular/core'
import { BuildFormValidator } from './form-validator.service'

@Injectable()
export class LoginValidatorsService {
  readonly LOGIN_USERNAME: BuildFormValidator
  readonly LOGIN_PASSWORD: BuildFormValidator

  constructor (private i18n: I18n) {
    this.LOGIN_USERNAME = {
      VALIDATORS: [
        Validators.required
      ],
      MESSAGES: {
        'required': this.i18n('Username is required.')
      }
    }

    this.LOGIN_PASSWORD = {
      VALIDATORS: [
        Validators.required
      ],
      MESSAGES: {
        'required': this.i18n('Password is required.')
      }
    }
  }
}
