import { I18n } from '@ngx-translate/i18n-polyfill'
import { Validators } from '@angular/forms'
import { Injectable } from '@angular/core'
import { BuildFormValidator } from './form-validator.service'

@Injectable()
export class VideoCaptionsValidatorsService {
  readonly VIDEO_CAPTION_LANGUAGE: BuildFormValidator
  readonly VIDEO_CAPTION_FILE: BuildFormValidator

  constructor (private i18n: I18n) {

    this.VIDEO_CAPTION_LANGUAGE = {
      VALIDATORS: [ Validators.required ],
      MESSAGES: {
        'required': this.i18n('Video caption language is required.')
      }
    }

    this.VIDEO_CAPTION_FILE = {
      VALIDATORS: [ Validators.required ],
      MESSAGES: {
        'required': this.i18n('Video caption file is required.')
      }
    }
  }
}
