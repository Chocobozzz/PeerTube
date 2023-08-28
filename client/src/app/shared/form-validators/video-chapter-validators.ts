import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'

export const VIDEO_CHAPTER_TITLE_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.minLength(2), Validators.maxLength(100) ], // Required is set dynamically
  MESSAGES: {
    required: $localize`A chapter title is required.`,
    minlength: $localize`A chapter title should be more than 2 characters long.`,
    maxlength: $localize`A chapter title should be less than 100 characters long.`
  }
}

export const VIDEO_CHAPTERS_ARRAY_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ uniqueTimecodeValidator() ],
  MESSAGES: {}
}

function uniqueTimecodeValidator (): ValidatorFn {
  return (control: AbstractControl): ValidationErrors => {
    const array = control.value as { timecode: number, title: string }[]

    for (const chapter of array) {
      if (!chapter.title) continue

      if (array.filter(c => c.title && c.timecode === chapter.timecode).length > 1) {
        return { uniqueTimecode: $localize`Multiple chapters have the same timecode ${chapter.timecode}` }
      }
    }

    return null
  }
}
