import { FormControl } from '@angular/forms';

export function validateEmail(c: FormControl) {
  // Thanks to http://emailregex.com/
  /* tslint:disable */
  const EMAIL_REGEXP = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

  return EMAIL_REGEXP.test(c.value) ? null : {
    email: {
      valid: false
    }
  };
}
