// Thanks: https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript

import { DatePipe } from '@angular/common'
import { environment } from '../../../environments/environment'
import { AuthService } from '../../core/auth'

function getParameterByName (name: string, url: string) {
  if (!url) url = window.location.href
  name = name.replace(/[\[\]]/g, '\\$&')

  const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
  const results = regex.exec(url)

  if (!results) return null
  if (!results[2]) return ''

  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

function populateAsyncUserVideoChannels (authService: AuthService, channel: { id: number, label: string, support: string }[]) {
  return new Promise(res => {
    authService.userInformationLoaded
      .subscribe(
        () => {
          const user = authService.getUser()
          if (!user) return

          const videoChannels = user.videoChannels
          if (Array.isArray(videoChannels) === false) return

          videoChannels.forEach(c => channel.push({ id: c.id, label: c.displayName, support: c.support }))

          return res()
        }
      )
  })
}

function getAbsoluteAPIUrl () {
  let absoluteAPIUrl = environment.apiUrl
  if (!absoluteAPIUrl) {
    // The API is on the same domain
    absoluteAPIUrl = window.location.origin
  }

  return absoluteAPIUrl
}

const datePipe = new DatePipe('en')
function dateToHuman (date: string) {
  return datePipe.transform(date, 'medium')
}

function immutableAssign <A, B> (target: A, source: B) {
  return Object.assign({}, target, source)
}

function objectToUrlEncoded (obj: any) {
  const str: string[] = []
  for (const key of Object.keys(obj)) {
    str.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]))
  }

  return str.join('&')
}

// Thanks: https://gist.github.com/ghinda/8442a57f22099bdb2e34
function objectToFormData (obj: any, form?: FormData, namespace?: string) {
  let fd = form || new FormData()
  let formKey

  for (let key of Object.keys(obj)) {
    if (namespace) formKey = `${namespace}[${key}]`
    else formKey = key

    if (obj[key] === undefined) continue

    if (Array.isArray(obj[key]) && obj[key].length === 0) {
      fd.append(key, null)
      continue
    }

    if (obj[key] !== null && typeof obj[ key ] === 'object' && !(obj[ key ] instanceof File)) {
      objectToFormData(obj[ key ], fd, key)
    } else {
      fd.append(formKey, obj[ key ])
    }
  }

  return fd
}

function lineFeedToHtml (obj: object, keyToNormalize: string) {
  return immutableAssign(obj, {
    [keyToNormalize]: obj[keyToNormalize].replace(/\r?\n|\r/g, '<br />')
  })
}

// Try to cache a little bit window.innerWidth
let windowInnerWidth = window.innerWidth
// setInterval(() => windowInnerWidth = window.innerWidth, 500)

function isInSmallView () {
  return windowInnerWidth < 600
}

function isInMobileView () {
  return windowInnerWidth < 500
}

export {
  objectToUrlEncoded,
  getParameterByName,
  populateAsyncUserVideoChannels,
  getAbsoluteAPIUrl,
  dateToHuman,
  isInSmallView,
  isInMobileView,
  immutableAssign,
  objectToFormData,
  lineFeedToHtml
}
