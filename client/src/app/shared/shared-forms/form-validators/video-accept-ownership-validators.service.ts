import { Injectable } from '@angular/core'
import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.service'

@Injectable()
export class VideoAcceptOwnershipValidatorsService {
  readonly CHANNEL: BuildFormValidator

  constructor () {
    this.CHANNEL = {
      VALIDATORS: [ Validators.required ],
      MESSAGES: {
        'required': $localize`The channel is required.`
      }
    }
  }
}
