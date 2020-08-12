import { Injectable } from '@angular/core'
import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.service'

@Injectable()
export class VideoCommentValidatorsService {
  readonly VIDEO_COMMENT_TEXT: BuildFormValidator

  constructor () {
    this.VIDEO_COMMENT_TEXT = {
      VALIDATORS: [ Validators.required, Validators.minLength(1), Validators.maxLength(3000) ],
      MESSAGES: {
        'required': $localize`Comment is required.`,
        'minlength': $localize`Comment must be at least 2 characters long.`,
        'maxlength': $localize`Comment cannot be more than 3000 characters long.`
      }
    }
  }
}
