import memoizee from 'memoizee'

export function Memoize (config?: memoizee.Options<any>) {
  return function (_target, _key, descriptor: PropertyDescriptor) {
    const oldFunction = descriptor.value
    const newFunction = memoizee(oldFunction, config)

    descriptor.value = function () {
      return newFunction.apply(this, arguments)
    }
  }
}
