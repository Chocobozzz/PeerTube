type ObjectKeys<T> =
  T extends object
    ? `${Exclude<keyof T, symbol>}`[]
    : T extends number
      ? []
      : T extends any | string
        ? string[]
        : never

interface ObjectConstructor {
  keys<T> (o: T): ObjectKeys<T>
}
