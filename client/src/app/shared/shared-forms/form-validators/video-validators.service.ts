import { I18n } from '@ngx-translate/i18n-polyfill'
import { Validators } from '@angular/forms'
import { Injectable } from '@angular/core'
import { BuildFormValidator } from './form-validator.service'

@Injectable()
export class VideoValidatorsService {
  readonly VIDEO_NAME: BuildFormValidator
  readonly VIDEO_PRIVACY: BuildFormValidator
  readonly VIDEO_CATEGORY: BuildFormValidator
  readonly VIDEO_LICENCE: BuildFormValidator
  readonly VIDEO_LANGUAGE: BuildFormValidator
  readonly VIDEO_IMAGE: BuildFormValidator
  readonly VIDEO_CHANNEL: BuildFormValidator
  readonly VIDEO_DESCRIPTION: BuildFormValidator
  readonly VIDEO_TAGS: BuildFormValidator
  readonly VIDEO_SUPPORT: BuildFormValidator
  readonly VIDEO_SCHEDULE_PUBLICATION_AT: BuildFormValidator
  readonly VIDEO_ORIGINALLY_PUBLISHED_AT: BuildFormValidator

  constructor (private i18n: I18n) {

    this.VIDEO_NAME = {
      VALIDATORS: [ Validators.required, Validators.minLength(3), Validators.maxLength(120) ],
      MESSAGES: {
        'required': this.i18n('Video name is required.'),
        'minlength': this.i18n('Video name must be at least 3 characters long.'),
        'maxlength': this.i18n('Video name cannot be more than 120 characters long.')
      }
    }

    this.VIDEO_PRIVACY = {
      VALIDATORS: [ Validators.required ],
      MESSAGES: {
        'required': this.i18n('Video privacy is required.')
      }
    }

    this.VIDEO_CATEGORY = {
      VALIDATORS: [ ],
      MESSAGES: {}
    }

    this.VIDEO_LICENCE = {
      VALIDATORS: [ ],
      MESSAGES: {}
    }

    this.VIDEO_LANGUAGE = {
      VALIDATORS: [ ],
      MESSAGES: {}
    }

    this.VIDEO_IMAGE = {
      VALIDATORS: [ ],
      MESSAGES: {}
    }

    this.VIDEO_CHANNEL = {
      VALIDATORS: [ Validators.required ],
      MESSAGES: {
        'required': this.i18n('Video channel is required.')
      }
    }

    this.VIDEO_DESCRIPTION = {
      VALIDATORS: [ Validators.minLength(3), Validators.maxLength(10000) ],
      MESSAGES: {
        'minlength': this.i18n('Video description must be at least 3 characters long.'),
        'maxlength': this.i18n('Video description cannot be more than 10000 characters long.')
      }
    }

    this.VIDEO_TAGS = {
      VALIDATORS: [ Validators.minLength(2), Validators.maxLength(30) ],
      MESSAGES: {
        'minlength': this.i18n('A tag should be more than 2 characters long.'),
        'maxlength': this.i18n('A tag should be less than 30 characters long.')
      }
    }

    this.VIDEO_SUPPORT = {
      VALIDATORS: [ Validators.minLength(3), Validators.maxLength(1000) ],
      MESSAGES: {
        'minlength': this.i18n('Video support must be at least 3 characters long.'),
        'maxlength': this.i18n('Video support cannot be more than 1000 characters long.')
      }
    }

    this.VIDEO_SCHEDULE_PUBLICATION_AT = {
      VALIDATORS: [ ],
      MESSAGES: {
        'required': this.i18n('A date is required to schedule video update.')
      }
    }

    this.VIDEO_ORIGINALLY_PUBLISHED_AT = {
      VALIDATORS: [ ],
      MESSAGES: {}
    }
  }
}
