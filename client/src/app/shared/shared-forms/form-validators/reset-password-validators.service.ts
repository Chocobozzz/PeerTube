import { I18n } from '@ngx-translate/i18n-polyfill'
import { Validators } from '@angular/forms'
import { Injectable } from '@angular/core'
import { BuildFormValidator } from './form-validator.service'

@Injectable()
export class ResetPasswordValidatorsService {
  readonly RESET_PASSWORD_CONFIRM: BuildFormValidator

  constructor (private i18n: I18n) {
    this.RESET_PASSWORD_CONFIRM = {
      VALIDATORS: [
        Validators.required
      ],
      MESSAGES: {
        'required': this.i18n('Confirmation of the password is required.')
      }
    }
  }
}
