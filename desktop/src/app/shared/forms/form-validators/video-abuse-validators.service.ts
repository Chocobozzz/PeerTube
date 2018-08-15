import { I18n } from '@ngx-translate/i18n-polyfill'
import { Validators } from '@angular/forms'
import { Injectable } from '@angular/core'
import { BuildFormValidator } from '@app/shared'

@Injectable()
export class VideoAbuseValidatorsService {
  readonly VIDEO_ABUSE_REASON: BuildFormValidator
  readonly VIDEO_ABUSE_MODERATION_COMMENT: BuildFormValidator

  constructor (private i18n: I18n) {
    this.VIDEO_ABUSE_REASON = {
      VALIDATORS: [ Validators.required, Validators.minLength(2), Validators.maxLength(300) ],
      MESSAGES: {
        'required': this.i18n('Report reason is required.'),
        'minlength': this.i18n('Report reason must be at least 2 characters long.'),
        'maxlength': this.i18n('Report reason cannot be more than 300 characters long.')
      }
    }

    this.VIDEO_ABUSE_MODERATION_COMMENT = {
      VALIDATORS: [ Validators.required, Validators.minLength(2), Validators.maxLength(300) ],
      MESSAGES: {
        'required': this.i18n('Moderation comment is required.'),
        'minlength': this.i18n('Moderation comment must be at least 2 characters long.'),
        'maxlength': this.i18n('Moderation comment cannot be more than 300 characters long.')
      }
    }
  }
}
