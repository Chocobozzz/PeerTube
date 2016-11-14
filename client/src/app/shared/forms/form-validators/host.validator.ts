import { FormControl } from '@angular/forms';

export function validateHost(c: FormControl) {
  let HOST_REGEXP = new RegExp('^(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$');

  return HOST_REGEXP.test(c.value) ? null : {
    validateHost: {
      valid: false
    }
  };
}
