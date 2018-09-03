import { I18n } from '@ngx-translate/i18n-polyfill'
import { Validators } from '@angular/forms'
import { Injectable } from '@angular/core'
import { BuildFormValidator } from '@app/shared'

@Injectable()
export class VideoChannelValidatorsService {
  readonly VIDEO_CHANNEL_NAME: BuildFormValidator
  readonly VIDEO_CHANNEL_DISPLAY_NAME: BuildFormValidator
  readonly VIDEO_CHANNEL_DESCRIPTION: BuildFormValidator
  readonly VIDEO_CHANNEL_SUPPORT: BuildFormValidator

  constructor (private i18n: I18n) {
    this.VIDEO_CHANNEL_NAME = {
      VALIDATORS: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(20),
        Validators.pattern(/^[a-z0-9._]+$/)
      ],
      MESSAGES: {
        'required': this.i18n('Name is required.'),
        'minlength': this.i18n('Name must be at least 3 characters long.'),
        'maxlength': this.i18n('Name cannot be more than 20 characters long.'),
        'pattern': this.i18n('Name should be only lowercase alphanumeric characters.')
      }
    }

    this.VIDEO_CHANNEL_DISPLAY_NAME = {
      VALIDATORS: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(120)
      ],
      MESSAGES: {
        'required': i18n('Display name is required.'),
        'minlength': i18n('Display name must be at least 3 characters long.'),
        'maxlength': i18n('Display name cannot be more than 120 characters long.')
      }
    }

    this.VIDEO_CHANNEL_DESCRIPTION = {
      VALIDATORS: [
        Validators.minLength(3),
        Validators.maxLength(500)
      ],
      MESSAGES: {
        'minlength': i18n('Description must be at least 3 characters long.'),
        'maxlength': i18n('Description cannot be more than 500 characters long.')
      }
    }

    this.VIDEO_CHANNEL_SUPPORT = {
      VALIDATORS: [
        Validators.minLength(3),
        Validators.maxLength(500)
      ],
      MESSAGES: {
        'minlength': i18n('Support text must be at least 3 characters long.'),
        'maxlength': i18n('Support text cannot be more than 500 characters long.')
      }
    }
  }
}
