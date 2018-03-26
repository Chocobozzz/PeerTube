import { Validators } from '@angular/forms'

export const VIDEO_COMMENT_TEXT = {
  VALIDATORS: [ Validators.required, Validators.minLength(1), Validators.maxLength(3000) ],
  MESSAGES: {
    'required': 'Comment is required.',
    'minlength': 'Comment must be at least 2 characters long.',
    'maxlength': 'Comment cannot be more than 3000 characters long.'
  }
}
