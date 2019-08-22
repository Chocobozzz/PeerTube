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
