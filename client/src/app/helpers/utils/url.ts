import { environment } from '../../../environments/environment'

// Thanks: https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
function getParameterByName (name: string, url: string) {
  if (!url) url = window.location.href
  name = name.replace(/[[\]]/g, '\\$&')

  const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
  const results = regex.exec(url)

  if (!results) return null
  if (!results[2]) return ''

  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

function getAbsoluteAPIUrl () {
  let absoluteAPIUrl = environment.hmr === true
    ? 'http://localhost:9000'
    : environment.apiUrl

  if (!absoluteAPIUrl) {
    // The API is on the same domain
    absoluteAPIUrl = window.location.origin
  }

  return absoluteAPIUrl
}

function getAbsoluteEmbedUrl () {
  let absoluteEmbedUrl = environment.originServerUrl
  if (!absoluteEmbedUrl) {
    // The Embed is on the same domain
    absoluteEmbedUrl = window.location.origin
  }

  return absoluteEmbedUrl
}

// Thanks: https://gist.github.com/ghinda/8442a57f22099bdb2e34
function objectToFormData (obj: any, form?: FormData, namespace?: string) {
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

export {
  getParameterByName,
  objectToFormData,
  getAbsoluteAPIUrl,
  getAbsoluteEmbedUrl
}
