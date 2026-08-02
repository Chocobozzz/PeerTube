export function Debounce (config: { timeoutMS: number }) {
  const timeoutRefKey = Symbol('debounce-timeout')

  return function (_target, _key, descriptor: PropertyDescriptor) {
    const original = descriptor.value

    descriptor.value = function (...args: any[]) {
      clearTimeout(this[timeoutRefKey])

      this[timeoutRefKey] = setTimeout(() => {
        original.apply(this, args)
      }, config.timeoutMS)
    }
  }
}
