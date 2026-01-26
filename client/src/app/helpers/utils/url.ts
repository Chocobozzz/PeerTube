import { environment } from '../../../environments/environment'

export function getAPIUrl () {
  return environment.apiUrl || window.location.origin
}

export function getOriginUrl () {
  return environment.originServerUrl || window.location.origin
}

export function getBackendUrl () {
  return environment.apiUrl || environment.originServerUrl || window.location.origin
}

export function getBackendHost () {
  return new URL(getBackendUrl()).host
}

// Thanks: https://gist.github.com/ghinda/8442a57f22099bdb2e34
export function objectToFormData (obj: any, form?: FormData, namespace?: string) {
  const fd = form || new FormData()
  let formKey

  for (const key of Object.keys(obj)) {
    if (namespace) formKey = `${namespace}[${key}]`
    else formKey = key

    if (obj[key] === undefined) continue

    if (Array.isArray(obj[key]) && obj[key].length === 0) {
      fd.append(key, null)
      continue
    }

    if (obj[key] !== null && typeof obj[key] === 'object' && !(obj[key] instanceof File)) {
      objectToFormData(obj[key], fd, formKey)
    } else {
      fd.append(formKey, obj[key])
    }
  }

  return fd
}
