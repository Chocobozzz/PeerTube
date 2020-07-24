import { I18n } from '@ngx-translate/i18n-polyfill'
import { Validators } from '@angular/forms'
import { Injectable } from '@angular/core'
import { BuildFormValidator } from './form-validator.service'

@Injectable()
export class AbuseValidatorsService {
  readonly ABUSE_REASON: BuildFormValidator
  readonly ABUSE_MODERATION_COMMENT: BuildFormValidator
  readonly ABUSE_MESSAGE: BuildFormValidator

  constructor (private i18n: I18n) {
    this.ABUSE_REASON = {
      VALIDATORS: [ Validators.required, Validators.minLength(2), Validators.maxLength(3000) ],
      MESSAGES: {
        'required': this.i18n('Report reason is required.'),
        'minlength': this.i18n('Report reason must be at least 2 characters long.'),
        'maxlength': this.i18n('Report reason cannot be more than 3000 characters long.')
      }
    }

    this.ABUSE_MODERATION_COMMENT = {
      VALIDATORS: [ Validators.required, Validators.minLength(2), Validators.maxLength(3000) ],
      MESSAGES: {
        'required': this.i18n('Moderation comment is required.'),
        'minlength': this.i18n('Moderation comment must be at least 2 characters long.'),
        'maxlength': this.i18n('Moderation comment cannot be more than 3000 characters long.')
      }
    }

    this.ABUSE_MESSAGE = {
      VALIDATORS: [ Validators.required, Validators.minLength(2), Validators.maxLength(3000) ],
      MESSAGES: {
        'required': this.i18n('Abuse message is required.'),
        'minlength': this.i18n('Abuse message must be at least 2 characters long.'),
        'maxlength': this.i18n('Abuse message cannot be more than 3000 characters long.')
      }
    }
  }
}
