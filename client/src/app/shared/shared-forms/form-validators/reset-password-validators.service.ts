import { Injectable } from '@angular/core'
import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.service'

@Injectable()
export class ResetPasswordValidatorsService {
  readonly RESET_PASSWORD_CONFIRM: BuildFormValidator

  constructor () {
    this.RESET_PASSWORD_CONFIRM = {
      VALIDATORS: [
        Validators.required
      ],
      MESSAGES: {
        'required': $localize`Confirmation of the password is required.`
      }
    }
  }
}
