export function Debounce (config: { timeoutMS: number }) {
  let timeoutRef: NodeJS.Timeout

  return function (_target, _key, descriptor: PropertyDescriptor) {
    const original = descriptor.value

    descriptor.value = function (...args: any[]) {
      clearTimeout(timeoutRef)

      timeoutRef = setTimeout(() => {
        original.apply(this, args)
      }, config.timeoutMS)
    }
  }
}
