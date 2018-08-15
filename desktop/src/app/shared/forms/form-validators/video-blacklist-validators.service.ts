import { I18n } from '@ngx-translate/i18n-polyfill'
import { Validators } from '@angular/forms'
import { Injectable } from '@angular/core'
import { BuildFormValidator } from '@app/shared'

@Injectable()
export class VideoBlacklistValidatorsService {
  readonly VIDEO_BLACKLIST_REASON: BuildFormValidator

  constructor (private i18n: I18n) {
    this.VIDEO_BLACKLIST_REASON = {
      VALIDATORS: [ Validators.minLength(2), Validators.maxLength(300) ],
      MESSAGES: {
        'minlength': this.i18n('Blacklist reason must be at least 2 characters long.'),
        'maxlength': this.i18n('Blacklist reason cannot be more than 300 characters long.')
      }
    }
  }
}
