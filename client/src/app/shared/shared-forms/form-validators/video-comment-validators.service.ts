import { I18n } from '@ngx-translate/i18n-polyfill'
import { Validators } from '@angular/forms'
import { Injectable } from '@angular/core'
import { BuildFormValidator } from './form-validator.service'

@Injectable()
export class VideoCommentValidatorsService {
  readonly VIDEO_COMMENT_TEXT: BuildFormValidator

  constructor (private i18n: I18n) {
    this.VIDEO_COMMENT_TEXT = {
      VALIDATORS: [ Validators.required, Validators.minLength(1), Validators.maxLength(3000) ],
      MESSAGES: {
        'required': this.i18n('Comment is required.'),
        'minlength': this.i18n('Comment must be at least 2 characters long.'),
        'maxlength': this.i18n('Comment cannot be more than 3000 characters long.')
      }
    }
  }
}
