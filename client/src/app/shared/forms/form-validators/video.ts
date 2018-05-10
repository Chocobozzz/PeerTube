import { Validators } from '@angular/forms'

export const VIDEO_NAME = {
  VALIDATORS: [ Validators.required, Validators.minLength(3), Validators.maxLength(120) ],
  MESSAGES: {
    'required': 'Video name is required.',
    'minlength': 'Video name must be at least 3 characters long.',
    'maxlength': 'Video name cannot be more than 120 characters long.'
  }
}

export const VIDEO_PRIVACY = {
  VALIDATORS: [ Validators.required ],
  MESSAGES: {
    'required': 'Video privacy is required.'
  }
}

export const VIDEO_CATEGORY = {
  VALIDATORS: [ ],
  MESSAGES: {}
}

export const VIDEO_LICENCE = {
  VALIDATORS: [ ],
  MESSAGES: {}
}

export const VIDEO_LANGUAGE = {
  VALIDATORS: [ ],
  MESSAGES: {}
}

export const VIDEO_IMAGE = {
  VALIDATORS: [ ],
  MESSAGES: {}
}

export const VIDEO_CHANNEL = {
  VALIDATORS: [ Validators.required ],
  MESSAGES: {
    'required': 'Video channel is required.'
  }
}

export const VIDEO_DESCRIPTION = {
  VALIDATORS: [ Validators.minLength(3), Validators.maxLength(10000) ],
  MESSAGES: {
    'minlength': 'Video description must be at least 3 characters long.',
    'maxlength': 'Video description cannot be more than 10000 characters long.'
  }
}

export const VIDEO_TAGS = {
  VALIDATORS: [ Validators.minLength(2), Validators.maxLength(30) ],
  MESSAGES: {
    'minlength': 'A tag should be more than 2 characters long.',
    'maxlength': 'A tag should be less than 30 characters long.'
  }
}

export const VIDEO_SUPPORT = {
  VALIDATORS: [ Validators.minLength(3), Validators.maxLength(500) ],
  MESSAGES: {
    'minlength': 'Video support must be at least 3 characters long.',
    'maxlength': 'Video support cannot be more than 500 characters long.'
  }
}
