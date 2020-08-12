import { Injectable } from '@angular/core'
import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms'
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
  readonly VIDEO_TAGS_ARRAY: BuildFormValidator
  readonly VIDEO_TAG: BuildFormValidator
  readonly VIDEO_SUPPORT: BuildFormValidator
  readonly VIDEO_SCHEDULE_PUBLICATION_AT: BuildFormValidator
  readonly VIDEO_ORIGINALLY_PUBLISHED_AT: BuildFormValidator

  constructor () {

    this.VIDEO_NAME = {
      VALIDATORS: [ Validators.required, Validators.minLength(3), Validators.maxLength(120) ],
      MESSAGES: {
        'required': $localize`Video name is required.`,
        'minlength': $localize`Video name must be at least 3 characters long.`,
        'maxlength': $localize`Video name cannot be more than 120 characters long.`
      }
    }

    this.VIDEO_PRIVACY = {
      VALIDATORS: [ Validators.required ],
      MESSAGES: {
        'required': $localize`Video privacy is required.`
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
        'required': $localize`Video channel is required.`
      }
    }

    this.VIDEO_DESCRIPTION = {
      VALIDATORS: [ Validators.minLength(3), Validators.maxLength(10000) ],
      MESSAGES: {
        'minlength': $localize`Video description must be at least 3 characters long.`,
        'maxlength': $localize`Video description cannot be more than 10000 characters long.`
      }
    }

    this.VIDEO_TAG = {
      VALIDATORS: [ Validators.minLength(2), Validators.maxLength(30) ],
      MESSAGES: {
        'minlength': $localize`A tag should be more than 2 characters long.`,
        'maxlength': $localize`A tag should be less than 30 characters long.`
      }
    }

    this.VIDEO_TAGS_ARRAY = {
      VALIDATORS: [ Validators.maxLength(5), this.arrayTagLengthValidator() ],
      MESSAGES: {
        'maxlength': $localize`A maximum of 5 tags can be used on a video.`,
        'arrayTagLength': $localize`A tag should be more than 2, and less than 30 characters long.`
      }
    }

    this.VIDEO_SUPPORT = {
      VALIDATORS: [ Validators.minLength(3), Validators.maxLength(1000) ],
      MESSAGES: {
        'minlength': $localize`Video support must be at least 3 characters long.`,
        'maxlength': $localize`Video support cannot be more than 1000 characters long.`
      }
    }

    this.VIDEO_SCHEDULE_PUBLICATION_AT = {
      VALIDATORS: [ ],
      MESSAGES: {
        'required': $localize`A date is required to schedule video update.`
      }
    }

    this.VIDEO_ORIGINALLY_PUBLISHED_AT = {
      VALIDATORS: [ ],
      MESSAGES: {}
    }
  }

  arrayTagLengthValidator (min = 2, max = 30): ValidatorFn {
    return (control: AbstractControl): ValidationErrors => {
      const array = control.value as Array<string>

      if (array.every(e => e.length > min && e.length < max)) {
        return null
      }

      return { 'arrayTagLength': true }
    }
  }
}
