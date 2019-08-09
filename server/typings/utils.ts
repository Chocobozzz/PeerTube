export type FunctionPropertyNames<T> = { [K in keyof T]: T[K] extends Function ? K : never }[keyof T]

export type FunctionProperties<T> = Pick<T, FunctionPropertyNames<T>>
