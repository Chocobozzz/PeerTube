import { Validators } from '@angular/forms'

export const VIDEO_ABUSE_REASON = {
  VALIDATORS: [ Validators.required, Validators.minLength(2), Validators.maxLength(300) ],
  MESSAGES: {
    'required': 'Report reason name is required.',
    'minlength': 'Report reson must be at least 2 characters long.',
    'maxlength': 'Report reson cannot be more than 300 characters long.'
  }
}
