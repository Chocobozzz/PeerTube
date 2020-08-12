import { Injectable } from '@angular/core'
import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.service'

@Injectable()
export class VideoCaptionsValidatorsService {
  readonly VIDEO_CAPTION_LANGUAGE: BuildFormValidator
  readonly VIDEO_CAPTION_FILE: BuildFormValidator

  constructor () {

    this.VIDEO_CAPTION_LANGUAGE = {
      VALIDATORS: [ Validators.required ],
      MESSAGES: {
        'required': $localize`Video caption language is required.`
      }
    }

    this.VIDEO_CAPTION_FILE = {
      VALIDATORS: [ Validators.required ],
      MESSAGES: {
        'required': $localize`Video caption file is required.`
      }
    }
  }
}
