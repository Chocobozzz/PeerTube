import { FormControl } from '@angular/forms';

export function validateUrl(c: FormControl) {
  let URL_REGEXP = new RegExp('^https?://(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$');

  return URL_REGEXP.test(c.value) ? null : {
    validateUrl: {
      valid: false
    }
  };
}
