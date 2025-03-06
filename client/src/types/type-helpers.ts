/* eslint-disable @typescript-eslint/array-type */
import { FormArray, FormControl, FormGroup } from '@angular/forms'

type Unbox<T> = T extends Array<infer V> ? V : T

export type ModelFormGroup<T> = FormGroup<
  { [K in keyof T]: T[K] extends Array<any> ? FormArray<FormControl<Unbox<T[K]>>> : FormControl<T[K]> }
>
