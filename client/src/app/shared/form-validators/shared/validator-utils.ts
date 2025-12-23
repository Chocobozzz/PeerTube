import { AbstractControl, ValidatorFn } from '@angular/forms'
import { splitAndGetNotEmpty } from '@root-helpers/string'

export const unique: ValidatorFn = (control: AbstractControl) => {
  if (!control.value) return null

  const hosts = splitAndGetNotEmpty(control.value)

  if (hosts.every((host: string) => hosts.indexOf(host) === hosts.lastIndexOf(host))) {
    return null
  }

  return {
    unique: {
      reason: 'invalid'
    }
  }
}
