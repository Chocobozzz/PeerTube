import { FormControl } from '@angular/forms';

export function validateHost(c: FormControl) {
  // Thanks to http://stackoverflow.com/a/106223
  let HOST_REGEXP = new RegExp(
    '^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$'
  );

  return HOST_REGEXP.test(c.value) ? null : {
    validateHost: {
      valid: false
    }
  };
}
