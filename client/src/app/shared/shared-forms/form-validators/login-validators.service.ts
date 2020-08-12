import { Injectable } from '@angular/core'
import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.service'

@Injectable()
export class LoginValidatorsService {
  readonly LOGIN_USERNAME: BuildFormValidator
  readonly LOGIN_PASSWORD: BuildFormValidator

  constructor () {
    this.LOGIN_USERNAME = {
      VALIDATORS: [
        Validators.required
      ],
      MESSAGES: {
        'required': $localize`Username is required.`
      }
    }

    this.LOGIN_PASSWORD = {
      VALIDATORS: [
        Validators.required
      ],
      MESSAGES: {
        'required': $localize`Password is required.`
      }
    }
  }
}
