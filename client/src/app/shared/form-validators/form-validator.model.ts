import { AsyncValidatorFn, ValidatorFn } from '@angular/forms'

export type BuildFormValidator = {
  VALIDATORS: ValidatorFn[]
  ASYNC_VALIDATORS?: AsyncValidatorFn[]

  MESSAGES: { [ name: string ]: string }
}

export type BuildFormArgument = {
  [ id: string ]: BuildFormValidator | BuildFormArgument
}

export type BuildFormDefaultValues = {
  [ name: string ]: boolean | number | string | string[] | BuildFormDefaultValues
}
