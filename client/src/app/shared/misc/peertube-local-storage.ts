// Thanks: https://github.com/capaj/localstorage-polyfill

const valuesMap = new Map()

class MemoryStorage {
  [key: string]: any
  [index: number]: string

  getItem (key) {
    const stringKey = String(key)
    if (valuesMap.has(key)) {
      return String(valuesMap.get(stringKey))
    }

    return null
  }

  setItem (key, val) {
    valuesMap.set(String(key), String(val))
  }

  removeItem (key) {
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
try {
  peertubeLocalStorage = localStorage
} catch (err) {
  const instance = new MemoryStorage()

  peertubeLocalStorage = new Proxy(instance, {
    set: function (obj, prop: string | number, value) {
      if (MemoryStorage.prototype.hasOwnProperty(prop)) {
        instance[prop] = value
      } else {
        instance.setItem(prop, value)
      }
      return true
    },
    get: function (target, name: string | number) {
      if (MemoryStorage.prototype.hasOwnProperty(name)) {
        return instance[name]
      }
      if (valuesMap.has(name)) {
        return instance.getItem(name)
      }
    }
  })
}

export { peertubeLocalStorage }
