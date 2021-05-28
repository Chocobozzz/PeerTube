// Thanks: https://github.com/capaj/localstorage-polyfill

const valuesMap = new Map()

function proxify (instance: MemoryStorage) {
  return new Proxy(instance, {
    set: function (obj, prop: string | symbol, value) {
      if (MemoryStorage.prototype.hasOwnProperty(prop)) {
        // FIXME: symbol typing issue https://github.com/microsoft/TypeScript/issues/1863
        instance[prop as any] = value
      } else {
        instance.setItem(prop, value)
      }
      return true
    },
    get: function (target, name: string | symbol | number) {
      if (MemoryStorage.prototype.hasOwnProperty(name)) {
        // FIXME: symbol typing issue https://github.com/microsoft/TypeScript/issues/1863
        return instance[name as any]
      }
      if (valuesMap.has(name)) {
        return instance.getItem(name)
      }
    }
  })
}

class MemoryStorage implements Storage {
  [key: string]: any

  getItem (key: any) {
    const stringKey = String(key)
    if (valuesMap.has(key)) {
      return String(valuesMap.get(stringKey))
    }

    return null
  }

  setItem (key: any, val: any) {
    valuesMap.set(String(key), String(val))
  }

  removeItem (key: any) {
    valuesMap.delete(key)
  }

  clear () {
    valuesMap.clear()
  }

  key (i: any) {
    if (arguments.length === 0) {
      throw new TypeError('Failed to execute "key" on "Storage": 1 argument required, but only 0 present.')
    }

    const arr = Array.from(valuesMap.keys())
    return arr[i]
  }

  get length () {
    return valuesMap.size
  }
}

let peertubeLocalStorage: Storage
let peertubeSessionStorage: Storage

function reinitStorage () {
  const instanceLocalStorage = new MemoryStorage()
  const instanceSessionStorage = new MemoryStorage()

  peertubeLocalStorage = proxify(instanceLocalStorage)
  peertubeSessionStorage = proxify(instanceSessionStorage)
}

try {
  peertubeLocalStorage = localStorage
  peertubeSessionStorage = sessionStorage
} catch (err) {
  // support Firefox and other browsers using an exception rather than null
  reinitStorage()
}

// support Brave and other browsers using null rather than an exception
if (peertubeLocalStorage === null || peertubeSessionStorage === null) {
  reinitStorage()
}

export {
  peertubeLocalStorage,
  peertubeSessionStorage
}
