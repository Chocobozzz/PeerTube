import { Validators } from '@angular/forms';

export const VIDEO_NAME = {
  VALIDATORS: [ Validators.required, Validators.minLength(3), Validators.maxLength(50) ],
  MESSAGES: {
    'required': 'Video name is required.',
    'minlength': 'Video name must be at least 3 characters long.',
    'maxlength': 'Video name cannot be more than 50 characters long.'
  }
};

export const VIDEO_CATEGORY = {
  VALIDATORS: [ Validators.required ],
  MESSAGES: {
    'required': 'Video category is required.'
  }
};

export const VIDEO_LICENCE = {
  VALIDATORS: [ Validators.required ],
  MESSAGES: {
    'required': 'Video licence is required.'
  }
};

export const VIDEO_LANGUAGE = {
  VALIDATORS: [ ],
  MESSAGES: {}
};

export const VIDEO_DESCRIPTION = {
  VALIDATORS: [ Validators.required, Validators.minLength(3), Validators.maxLength(250) ],
  MESSAGES: {
    'required': 'Video description is required.',
    'minlength': 'Video description must be at least 3 characters long.',
    'maxlength': 'Video description cannot be more than 250 characters long.'
  }
};

export const VIDEO_TAGS = {
  VALIDATORS: [ Validators.maxLength(10) ],
  MESSAGES: {
    'maxlength': 'A tag should be less than 10 characters long.'
  }
};
