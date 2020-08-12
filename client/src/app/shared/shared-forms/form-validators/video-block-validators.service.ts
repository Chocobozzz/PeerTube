import { Injectable } from '@angular/core'
import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.service'

@Injectable()
export class VideoBlockValidatorsService {
  readonly VIDEO_BLOCK_REASON: BuildFormValidator

  constructor () {
    this.VIDEO_BLOCK_REASON = {
      VALIDATORS: [ Validators.minLength(2), Validators.maxLength(300) ],
      MESSAGES: {
        'minlength': $localize`Block reason must be at least 2 characters long.`,
        'maxlength': $localize`Block reason cannot be more than 300 characters long.`
      }
    }
  }
}
