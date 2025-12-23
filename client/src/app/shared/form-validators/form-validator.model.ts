import { AsyncValidatorFn, FormArray, FormControl, FormGroup, ValidatorFn } from '@angular/forms'

export type BuildFormValidator = {
  VALIDATORS: ValidatorFn[]
  ASYNC_VALIDATORS?: AsyncValidatorFn[]

  MESSAGES: { [name: string]: string }
}

export type BuildFormArgument = {
  [id: string]: BuildFormValidator | BuildFormArgument
}

export type BuildFormArgumentTyped<Form> = ReplaceForm<Form, BuildFormValidator>

// ---------------------------------------------------------------------------

export type FormDefault = {
  [name: string]: Blob | Date | boolean | number | number[] | string | string[] | FormDefault | FormDefault[]
}
export type FormDefaultTyped<Form> = Partial<UnwrapForm<Form>>

// ---------------------------------------------------------------------------

export type FormReactiveMessages = {
  [id: string]: { [name: string]: string } | FormReactiveMessages | FormReactiveMessages[] | string
}

export type FormReactiveMessagesTyped<Form> = Partial<ReplaceForm<Form, string>>

// ---------------------------------------------------------------------------

export type FormReactiveErrors = { [id: string]: string | FormReactiveErrors | FormReactiveErrors[] }
export type FormReactiveErrorsTyped<Form> = Partial<ReplaceForm<Form, string>>

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

export type UnwrapForm<Form> = {
  [K in keyof Form]: _UnwrapForm<Form[K]>
}

type _UnwrapForm<T> = T extends FormGroup<infer U> ? Partial<UnwrapForm<U>> :
  T extends FormArray<infer U> ? _UnwrapForm<U>[] :
  T extends FormControl<Blob> ? Blob :
  T extends FormControl<infer U> ? U
  : never

// ---------------------------------------------------------------------------

export type ReplaceForm<Form, By> = {
  [K in keyof Form]: _ReplaceForm<Form[K], By>
}

type _ReplaceForm<T, By> = T extends FormGroup<infer U> ? ReplaceForm<U, By> :
  T extends FormArray<infer U> ? _ReplaceForm<U, By> :
  T extends FormControl ? By
  : never
