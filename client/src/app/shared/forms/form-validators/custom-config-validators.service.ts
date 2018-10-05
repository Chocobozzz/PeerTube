import { Validators } from '@angular/forms'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { BuildFormValidator } from '@app/shared'
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
  readonly TRANSCODING_CONCURRENCY: BuildFormValidator
  readonly TRANSCODING_NICENESS: BuildFormValidator
  readonly TRANSCODING_TTL: BuildFormValidator

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
      VALIDATORS: [ Validators.required, Validators.min(1), Validators.pattern('[0-9]+') ],
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

    this.TRANSCODING_CONCURRENCY = {
      VALIDATORS: [ Validators.required, Validators.min(1) ],
      MESSAGES: {
        'required': this.i18n('Transcoding concurrency is required.'),
        'min': this.i18n('Transcoding concurrency must be greater or equal to 1.')
      }
    }

    this.TRANSCODING_NICENESS = {
      VALIDATORS: [ Validators.required, Validators.min(1), Validators.max(18) ],
      MESSAGES: {
        'required': this.i18n('Transcoding niceness is required, from 1 to 18.'),
        'min': this.i18n('Transcoding niceness must be greater or equal to 1.'),
        'max': this.i18n('Transcoding niceness must be less than or equal to 18.')
      }
    }

    this.TRANSCODING_TTL = {
      VALIDATORS: [ Validators.required ],
      MESSAGES: {
        'required': this.i18n('Transcoding ttl duration is required. eg. "2 days" or "12 hours".')
      }
    }
  }
}
