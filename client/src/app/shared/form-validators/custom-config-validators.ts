import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'

export const INSTANCE_NAME_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [Validators.required],
  MESSAGES: {
    'required': $localize`Instance name is required.`
  }
}

export const INSTANCE_SHORT_DESCRIPTION_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [Validators.max(250)],
  MESSAGES: {
    'max': $localize`Short description should not be longer than 250 characters.`
  }
}

export const SERVICES_TWITTER_USERNAME_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [Validators.required],
  MESSAGES: {
    'required': $localize`Twitter username is required.`
  }
}

export const CACHE_PREVIEWS_SIZE_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [Validators.required, Validators.min(1), Validators.pattern('[0-9]+')],
  MESSAGES: {
    'required': $localize`Previews cache size is required.`,
    'min': $localize`Previews cache size must be greater than 1.`,
    'pattern': $localize`Previews cache size must be a number.`
  }
}

export const CACHE_CAPTIONS_SIZE_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [Validators.required, Validators.min(1), Validators.pattern('[0-9]+')],
  MESSAGES: {
    'required': $localize`Captions cache size is required.`,
    'min': $localize`Captions cache size must be greater than 1.`,
    'pattern': $localize`Captions cache size must be a number.`
  }
}

export const SIGNUP_LIMIT_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [Validators.required, Validators.min(-1), Validators.pattern('-?[0-9]+')],
  MESSAGES: {
    'required': $localize`Signup limit is required.`,
    'min': $localize`Signup limit must be greater than 1.`,
    'pattern': $localize`Signup limit must be a number.`
  }
}

export const ADMIN_EMAIL_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [Validators.required, Validators.email],
  MESSAGES: {
    'required': $localize`Admin email is required.`,
    'email': $localize`Admin email must be valid.`
  }
}

export const TRANSCODING_THREADS_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [Validators.required, Validators.min(0)],
  MESSAGES: {
    'required': $localize`Transcoding threads is required.`,
    'min': $localize`Transcoding threads must be greater or equal to 0.`
  }
}

export const MAX_LIVE_DURATION_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [Validators.required, Validators.min(-1)],
  MESSAGES: {
    'required': $localize`Max live duration is required.`,
    'min': $localize`Max live duration should be greater or equal to -1.`
  }
}

export const MAX_INSTANCE_LIVES_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [Validators.required, Validators.min(-1)],
  MESSAGES: {
    'required': $localize`Max instance lives is required.`,
    'min': $localize`Max instance lives should be greater or equal to -1.`
  }
}

export const MAX_USER_LIVES_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [Validators.required, Validators.min(-1)],
  MESSAGES: {
    'required': $localize`Max user lives is required.`,
    'min': $localize`Max user lives should be greater or equal to -1.`
  }
}

export const CONCURRENCY_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [Validators.required, Validators.min(1)],
  MESSAGES: {
    'required': $localize`Concurrency is required.`,
    'min': $localize`Concurrency should be greater or equal to 1.`
  }
}

export const INDEX_URL_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [Validators.pattern(/^https:\/\//)],
  MESSAGES: {
    'pattern': $localize`Index URL should be a URL`
  }
}

export const SEARCH_INDEX_URL_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [Validators.pattern(/^https?:\/\//)],
  MESSAGES: {
    'pattern': $localize`Search index URL should be a URL`
  }
}
