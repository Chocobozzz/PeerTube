import { I18n } from '@ngx-translate/i18n-polyfill'
import { Validators } from '@angular/forms'
import { Injectable } from '@angular/core'
import { BuildFormValidator } from './form-validator.service'

@Injectable()
export class VideoBlockValidatorsService {
  readonly VIDEO_BLOCK_REASON: BuildFormValidator

  constructor (private i18n: I18n) {
    this.VIDEO_BLOCK_REASON = {
      VALIDATORS: [ Validators.minLength(2), Validators.maxLength(300) ],
      MESSAGES: {
        'minlength': this.i18n('Block reason must be at least 2 characters long.'),
        'maxlength': this.i18n('Block reason cannot be more than 300 characters long.')
      }
    }
  }
}
