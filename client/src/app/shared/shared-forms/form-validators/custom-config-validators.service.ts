import { Validators } from '@angular/forms'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { BuildFormValidator } from './form-validator.service'
import { Injectable } from '@angular/core'

@Injectable()
export class CustomConfigValidatorsService {
  readonly INSTANCE_NAME: BuildFormValidator
  readonly INSTANCE_SHORT_DESCRIPTION: BuildFormValidator
  readonly SERVICES_TWITTER_USERNAME: BuildFormValidator
  readonly CACHE_PREVIEWS_SIZE: BuildFormValidator
  readonly CACHE_CAPTIONS_SIZE: BuildFormValidator
  readonly SIGNUP_LIMIT: BuildFormValidator
  readonly ADMIN_EMAIL: BuildFormValidator
  readonly TRANSCODING_THREADS: BuildFormValidator
  readonly INDEX_URL: BuildFormValidator
  readonly SEARCH_INDEX_URL: BuildFormValidator

  constructor (private i18n: I18n) {
    this.INSTANCE_NAME = {
      VALIDATORS: [ Validators.required ],
      MESSAGES: {
        'required': this.i18n('Instance name is required.')
      }
    }

    this.INSTANCE_SHORT_DESCRIPTION = {
      VALIDATORS: [ Validators.max(250) ],
      MESSAGES: {
        'max': this.i18n('Short description should not be longer than 250 characters.')
      }
    }

    this.SERVICES_TWITTER_USERNAME = {
      VALIDATORS: [ Validators.required ],
      MESSAGES: {
        'required': this.i18n('Twitter username is required.')
      }
    }

    this.CACHE_PREVIEWS_SIZE = {
      VALIDATORS: [ Validators.required, Validators.min(1), Validators.pattern('[0-9]+') ],
      MESSAGES: {
        'required': this.i18n('Previews cache size is required.'),
        'min': this.i18n('Previews cache size must be greater than 1.'),
        'pattern': this.i18n('Previews cache size must be a number.')
      }
    }

    this.CACHE_CAPTIONS_SIZE = {
      VALIDATORS: [ Validators.required, Validators.min(1), Validators.pattern('[0-9]+') ],
      MESSAGES: {
        'required': this.i18n('Captions cache size is required.'),
        'min': this.i18n('Captions cache size must be greater than 1.'),
        'pattern': this.i18n('Captions cache size must be a number.')
      }
    }

    this.SIGNUP_LIMIT = {
      VALIDATORS: [ Validators.required, Validators.min(-1), Validators.pattern('-?[0-9]+') ],
      MESSAGES: {
        'required': this.i18n('Signup limit is required.'),
        'min': this.i18n('Signup limit must be greater than 1.'),
        'pattern': this.i18n('Signup limit must be a number.')
      }
    }

    this.ADMIN_EMAIL = {
      VALIDATORS: [ Validators.required, Validators.email ],
      MESSAGES: {
        'required': this.i18n('Admin email is required.'),
        'email': this.i18n('Admin email must be valid.')
      }
    }

    this.TRANSCODING_THREADS = {
      VALIDATORS: [ Validators.required, Validators.min(0) ],
      MESSAGES: {
        'required': this.i18n('Transcoding threads is required.'),
        'min': this.i18n('Transcoding threads must be greater or equal to 0.')
      }
    }

    this.INDEX_URL = {
      VALIDATORS: [ Validators.pattern(/^https:\/\//) ],
      MESSAGES: {
        'pattern': this.i18n('Index URL should be a URL')
      }
    }

    this.SEARCH_INDEX_URL = {
      VALIDATORS: [ Validators.pattern(/^https?:\/\//) ],
      MESSAGES: {
        'pattern': this.i18n('Search index URL should be a URL')
      }
    }
  }
}
