import { I18n } from '@ngx-translate/i18n-polyfill'
import { Validators } from '@angular/forms'
import { Injectable } from '@angular/core'
import { BuildFormValidator } from './form-validator.service'

@Injectable()
export class VideoAcceptOwnershipValidatorsService {
  readonly CHANNEL: BuildFormValidator

  constructor (private i18n: I18n) {
    this.CHANNEL = {
      VALIDATORS: [ Validators.required ],
      MESSAGES: {
        'required': this.i18n('The channel is required.')
      }
    }
  }
}
