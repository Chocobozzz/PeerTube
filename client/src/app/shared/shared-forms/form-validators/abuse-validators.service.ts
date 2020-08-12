import { Injectable } from '@angular/core'
import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.service'

@Injectable()
export class AbuseValidatorsService {
  readonly ABUSE_REASON: BuildFormValidator
  readonly ABUSE_MODERATION_COMMENT: BuildFormValidator
  readonly ABUSE_MESSAGE: BuildFormValidator

  constructor () {
    this.ABUSE_REASON = {
      VALIDATORS: [ Validators.required, Validators.minLength(2), Validators.maxLength(3000) ],
      MESSAGES: {
        'required': $localize`Report reason is required.`,
        'minlength': $localize`Report reason must be at least 2 characters long.`,
        'maxlength': $localize`Report reason cannot be more than 3000 characters long.`
      }
    }

    this.ABUSE_MODERATION_COMMENT = {
      VALIDATORS: [ Validators.required, Validators.minLength(2), Validators.maxLength(3000) ],
      MESSAGES: {
        'required': $localize`Moderation comment is required.`,
        'minlength': $localize`Moderation comment must be at least 2 characters long.`,
        'maxlength': $localize`Moderation comment cannot be more than 3000 characters long.`
      }
    }

    this.ABUSE_MESSAGE = {
      VALIDATORS: [ Validators.required, Validators.minLength(2), Validators.maxLength(3000) ],
      MESSAGES: {
        'required': $localize`Abuse message is required.`,
        'minlength': $localize`Abuse message must be at least 2 characters long.`,
        'maxlength': $localize`Abuse message cannot be more than 3000 characters long.`
      }
    }
  }
}
