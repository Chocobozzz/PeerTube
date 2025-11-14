/**
 * Simple memoize only support methods that accept 0 or 1 argument
 * You can easily use it adding @SimpleMemoize just above the method name
 */

export function SimpleMemoize () {
  const store = new Map()

  return (_target: object, _propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    if (descriptor.value != null) {
      descriptor.value = getNewFunction(descriptor.value, store)
      return
    }

    throw new Error('Only put a Memoize() decorator on a method accessor.')
  }
}

function getNewFunction (originalMethod: () => void, store: Map<any, any>) {
  return function (this: any, ...args: any[]) {
    if (args.length > 1) {
      throw new Error('Simple memoize only support 0 or 1 argument')
    }

    let returnedValue: any

    if (args.length > 0) {
      const hashKey = args[0]

      if (store.has(hashKey)) {
        returnedValue = store.get(hashKey)
      } else {
        returnedValue = originalMethod.apply(this, args)
        store.set(hashKey, returnedValue)
      }
    } else if (store.has(this)) {
      returnedValue = store.get(this)
    } else {
      returnedValue = originalMethod.apply(this, args)
      store.set(this, returnedValue)
    }

    return returnedValue
  }
}
