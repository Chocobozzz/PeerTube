import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'

export const INSTANCE_NAME_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required ],
  MESSAGES: {
    required: $localize`Instance name is required.`
  }
}

export const INSTANCE_SHORT_DESCRIPTION_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.maxLength(250) ],
  MESSAGES: {
    maxlength: $localize`Short description must not be longer than 250 characters.`
  }
}

export const SERVICES_TWITTER_USERNAME_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required ],
  MESSAGES: {
    required: $localize`Twitter username is required.`
  }
}

export const CACHE_SIZE_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.min(1), Validators.pattern('[0-9]+') ],
  MESSAGES: {
    required: $localize`Cache size is required.`,
    min: $localize`Cache size must be greater than 1.`,
    pattern: $localize`Cache size must be a number.`
  }
}

export const SIGNUP_LIMIT_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.min(-1), Validators.pattern('-?[0-9]+') ],
  MESSAGES: {
    required: $localize`Signup limit is required.`,
    min: $localize`Signup limit must be greater than 1. Use -1 to disable it.`,
    pattern: $localize`Signup limit must be a number.`
  }
}

export const SIGNUP_MINIMUM_AGE_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.min(1), Validators.pattern('[0-9]+') ],
  MESSAGES: {
    required: $localize`Signup minimum age is required.`,
    min: $localize`Signup minimum age must be greater than 1.`,
    pattern: $localize`Signup minimum age must be a number.`
  }
}

export const ADMIN_EMAIL_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.email ],
  MESSAGES: {
    required: $localize`Admin email is required.`,
    email: $localize`Admin email must be valid.`
  }
}

export const TRANSCODING_THREADS_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.min(0) ],
  MESSAGES: {
    required: $localize`Transcoding threads is required.`,
    min: $localize`Transcoding threads must be greater or equal to 0.`
  }
}

export const TRANSCODING_MAX_FPS_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.min(1) ],
  MESSAGES: {
    required: $localize`Transcoding max FPS is required.`,
    min: $localize`Transcoding max FPS must be greater or equal to 1.`
  }
}

export const MAX_LIVE_DURATION_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.min(-1) ],
  MESSAGES: {
    required: $localize`Max live duration is required.`,
    min: $localize`Max live duration must be greater or equal to -1.`
  }
}

export const MAX_INSTANCE_LIVES_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.min(-1) ],
  MESSAGES: {
    required: $localize`Max instance lives is required.`,
    min: $localize`Max instance lives must be greater or equal to -1.`
  }
}

export const MAX_USER_LIVES_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.min(-1) ],
  MESSAGES: {
    required: $localize`Max user lives is required.`,
    min: $localize`Max user lives must be greater or equal to -1.`
  }
}

export const MAX_VIDEO_CHANNELS_PER_USER_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.min(1), Validators.pattern('[0-9]+') ],
  MESSAGES: {
    required: $localize`Max video channels per user is required.`,
    min: $localize`Max video channels per user must be greater or equal to 1.`,
    pattern: $localize`Max video channels per user must be a number.`
  }
}

export const MAX_SYNC_PER_USER: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.min(1), Validators.pattern('[0-9]+') ],
  MESSAGES: {
    required: $localize`Max synchronizations per user is required.`,
    min: $localize`Max synchronizations per user must be greater or equal to 1.`,
    pattern: $localize`Max synchronizations per user must be a number.`
  }
}

export const CONCURRENCY_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.min(1) ],
  MESSAGES: {
    required: $localize`Concurrency is required.`,
    min: $localize`Concurrency must be greater or equal to 1.`
  }
}

export const INDEX_URL_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.pattern(/^https:\/\//) ],
  MESSAGES: {
    pattern: $localize`Index URL must be a URL`
  }
}

export const SEARCH_INDEX_URL_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.pattern(/^https?:\/\//) ],
  MESSAGES: {
    pattern: $localize`Search index URL must be a URL`
  }
}

export const EXPORT_EXPIRATION_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.min(1) ],
  MESSAGES: {
    required: $localize`Export expiration is required.`,
    min: $localize`Export expiration must be greater or equal to 1.`
  }
}
export const EXPORT_MAX_USER_VIDEO_QUOTA_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.min(1) ],
  MESSAGES: {
    required: $localize`Max user video quota is required.`,
    min: $localize`Max user video video quota must be greater or equal to 1.`
  }
}
