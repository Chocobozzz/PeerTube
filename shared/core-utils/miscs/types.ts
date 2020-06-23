/* eslint-disable @typescript-eslint/array-type */

export type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? K : never
}[keyof T]

export type FunctionProperties<T> = Pick<T, FunctionPropertyNames<T>>

export type PickWith<T, KT extends keyof T, V> = {
  [P in KT]: T[P] extends V ? V : never
}

export type PickWithOpt<T, KT extends keyof T, V> = {
  [P in KT]?: T[P] extends V ? V : never
}

// https://github.com/krzkaczor/ts-essentials Rocks!
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends ReadonlyArray<infer U>
      ? ReadonlyArray<DeepPartial<U>>
      : DeepPartial<T[P]>
}

type Primitive = string | Function | number | boolean | Symbol | undefined | null
export type DeepOmitHelper<T, K extends keyof T> = {
  [P in K]: // extra level of indirection needed to trigger homomorhic behavior
  T[P] extends infer TP // distribute over unions
    ? TP extends Primitive
      ? TP // leave primitives and functions alone
      : TP extends any[]
        ? DeepOmitArray<TP, K> // Array special handling
        : DeepOmit<TP, K>
    : never
}
export type DeepOmit<T, K> = T extends Primitive ? T : DeepOmitHelper<T, Exclude<keyof T, K>>

export type DeepOmitArray<T extends any[], K> = {
  [P in keyof T]: DeepOmit<T[P], K>
}
