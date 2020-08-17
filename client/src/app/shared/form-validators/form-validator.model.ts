import { ValidatorFn } from '@angular/forms'

export type BuildFormValidator = {
  VALIDATORS: ValidatorFn[],
  MESSAGES: { [ name: string ]: string }
}

export type BuildFormArgument = {
  [ id: string ]: BuildFormValidator | BuildFormArgument
}

export type BuildFormDefaultValues = {
  [ name: string ]: string | string[] | BuildFormDefaultValues
}
