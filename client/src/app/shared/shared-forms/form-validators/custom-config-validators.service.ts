import { Injectable } from '@angular/core'
import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.service'

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

  constructor () {
    this.INSTANCE_NAME = {
      VALIDATORS: [ Validators.required ],
      MESSAGES: {
        'required': $localize`Instance name is required.`
      }
    }

    this.INSTANCE_SHORT_DESCRIPTION = {
      VALIDATORS: [ Validators.max(250) ],
      MESSAGES: {
        'max': $localize`Short description should not be longer than 250 characters.`
      }
    }

    this.SERVICES_TWITTER_USERNAME = {
      VALIDATORS: [ Validators.required ],
      MESSAGES: {
        'required': $localize`Twitter username is required.`
      }
    }

    this.CACHE_PREVIEWS_SIZE = {
      VALIDATORS: [ Validators.required, Validators.min(1), Validators.pattern('[0-9]+') ],
      MESSAGES: {
        'required': $localize`Previews cache size is required.`,
        'min': $localize`Previews cache size must be greater than 1.`,
        'pattern': $localize`Previews cache size must be a number.`
      }
    }

    this.CACHE_CAPTIONS_SIZE = {
      VALIDATORS: [ Validators.required, Validators.min(1), Validators.pattern('[0-9]+') ],
      MESSAGES: {
        'required': $localize`Captions cache size is required.`,
        'min': $localize`Captions cache size must be greater than 1.`,
        'pattern': $localize`Captions cache size must be a number.`
      }
    }

    this.SIGNUP_LIMIT = {
      VALIDATORS: [ Validators.required, Validators.min(-1), Validators.pattern('-?[0-9]+') ],
      MESSAGES: {
        'required': $localize`Signup limit is required.`,
        'min': $localize`Signup limit must be greater than 1.`,
        'pattern': $localize`Signup limit must be a number.`
      }
    }

    this.ADMIN_EMAIL = {
      VALIDATORS: [ Validators.required, Validators.email ],
      MESSAGES: {
        'required': $localize`Admin email is required.`,
        'email': $localize`Admin email must be valid.`
      }
    }

    this.TRANSCODING_THREADS = {
      VALIDATORS: [ Validators.required, Validators.min(0) ],
      MESSAGES: {
        'required': $localize`Transcoding threads is required.`,
        'min': $localize`Transcoding threads must be greater or equal to 0.`
      }
    }

    this.INDEX_URL = {
      VALIDATORS: [ Validators.pattern(/^https:\/\//) ],
      MESSAGES: {
        'pattern': $localize`Index URL should be a URL`
      }
    }

    this.SEARCH_INDEX_URL = {
      VALIDATORS: [ Validators.pattern(/^https?:\/\//) ],
      MESSAGES: {
        'pattern': $localize`Search index URL should be a URL`
      }
    }
  }
}
