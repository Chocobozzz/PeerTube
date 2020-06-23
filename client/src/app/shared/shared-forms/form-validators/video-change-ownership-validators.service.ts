import { I18n } from '@ngx-translate/i18n-polyfill'
import { AbstractControl, ValidationErrors, Validators } from '@angular/forms'
import { Injectable } from '@angular/core'
import { BuildFormValidator } from './form-validator.service'

@Injectable()
export class VideoChangeOwnershipValidatorsService {
  readonly USERNAME: BuildFormValidator

  constructor (private i18n: I18n) {
    this.USERNAME = {
      VALIDATORS: [ Validators.required, this.localAccountValidator ],
      MESSAGES: {
        'required': this.i18n('The username is required.'),
        'localAccountOnly': this.i18n('You can only transfer ownership to a local account')
      }
    }
  }

  localAccountValidator (control: AbstractControl): ValidationErrors {
    if (control.value.includes('@')) {
      return { 'localAccountOnly': true }
    }

    return null
  }
}
