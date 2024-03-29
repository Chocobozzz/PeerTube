import { AbstractControl, ValidatorFn, Validators } from '@angular/forms'
import { splitAndGetNotEmpty } from '@root-helpers/string'
import { BuildFormValidator } from './form-validator.model'
import { unique } from './shared/validator-utils'

const validWords: ValidatorFn = (control: AbstractControl) => {
  if (!control.value) return null

  const errors = []
  const words = splitAndGetNotEmpty(control.value)

  for (const word of words) {
    if (word.length < 1 || word.length > 100) {
      errors.push($localize`${word} is not valid (min 1 character/max 100 characters)`)
    }
  }

  if (words.length > 500) {
    errors.push($localize`There are too much words in the list (max 500 words)`)
  }

  // valid
  if (errors.length === 0) return null

  return {
    validWords: {
      reason: 'invalid',
      value: errors.join('. ') + '.'
    }
  }
}

// ---------------------------------------------------------------------------

export const WATCHED_WORDS_LIST_NAME_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.minLength(1), Validators.maxLength(100) ],
  MESSAGES: {
    required: $localize`List name is required.`,
    minlength: $localize`List name must be at least 1 character long.`,
    maxlength: $localize`List name cannot be more than 100 characters long.`
  }
}

export const UNIQUE_WATCHED_WORDS_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, unique, validWords ],
  MESSAGES: {
    required: $localize`Words are required.`,
    unique: $localize`Words entered contain duplicates.`,
    validWords: $localize`A word must be between 1 and 100 characters and the total number of words must not exceed 500 items`
  }
}
