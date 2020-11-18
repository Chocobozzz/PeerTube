import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'

export const VIDEO_NAME_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.minLength(3), Validators.maxLength(120) ],
  MESSAGES: {
    'required': $localize`Video name is required.`,
    'minlength': $localize`Video name must be at least 3 characters long.`,
    'maxlength': $localize`Video name cannot be more than 120 characters long.`
  }
}

export const VIDEO_PRIVACY_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required ],
  MESSAGES: {
    'required': $localize`Video privacy is required.`
  }
}

export const VIDEO_CATEGORY_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ ],
  MESSAGES: {}
}

export const VIDEO_LICENCE_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ ],
  MESSAGES: {}
}

export const VIDEO_LANGUAGE_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ ],
  MESSAGES: {}
}

export const VIDEO_IMAGE_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ ],
  MESSAGES: {}
}

export const VIDEO_CHANNEL_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required ],
  MESSAGES: {
    'required': $localize`Video channel is required.`
  }
}

export const VIDEO_DESCRIPTION_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.minLength(3), Validators.maxLength(10000) ],
  MESSAGES: {
    'minlength': $localize`Video description must be at least 3 characters long.`,
    'maxlength': $localize`Video description cannot be more than 10000 characters long.`
  }
}

export const VIDEO_TAG_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.minLength(2), Validators.maxLength(30) ],
  MESSAGES: {
    'minlength': $localize`A tag should be more than 2 characters long.`,
    'maxlength': $localize`A tag should be less than 30 characters long.`
  }
}

export const VIDEO_TAGS_ARRAY_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.maxLength(5), arrayTagLengthValidator() ],
  MESSAGES: {
    'maxlength': $localize`A maximum of 5 tags can be used on a video.`,
    'arrayTagLength': $localize`A tag should be more than 1 and less than 30 characters long.`
  }
}

export const VIDEO_SUPPORT_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.minLength(3), Validators.maxLength(1000) ],
  MESSAGES: {
    'minlength': $localize`Video support must be at least 3 characters long.`,
    'maxlength': $localize`Video support cannot be more than 1000 characters long.`
  }
}

export const VIDEO_SCHEDULE_PUBLICATION_AT_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ ],
  MESSAGES: {
    'required': $localize`A date is required to schedule video update.`
  }
}

export const VIDEO_ORIGINALLY_PUBLISHED_AT_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ ],
  MESSAGES: {}
}

function arrayTagLengthValidator (min = 2, max = 30): ValidatorFn {
  return (control: AbstractControl): ValidationErrors => {
    const array = control.value as Array<string>

    if (array.every(e => e.length >= min && e.length <= max)) {
      return null
    }

    return { 'arrayTagLength': true }
  }
}
