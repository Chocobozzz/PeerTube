import { environment } from '../../../environments/environment'

export function getAbsoluteAPIUrl () {
  let absoluteAPIUrl = environment.hmr === true
    ? 'http://localhost:9000'
    : environment.apiUrl

  if (!absoluteAPIUrl) {
    // The API is on the same domain
    absoluteAPIUrl = window.location.origin
  }

  return absoluteAPIUrl
}

export function getOriginUrl () {
  return environment.originServerUrl || window.location.origin
}

export function getAPIHost () {
  return new URL(getAbsoluteAPIUrl()).host
}

export function getAbsoluteEmbedUrl () {
  let absoluteEmbedUrl = environment.originServerUrl
  if (!absoluteEmbedUrl) {
    // The Embed is on the same domain
    absoluteEmbedUrl = window.location.origin
  }

  return absoluteEmbedUrl
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
