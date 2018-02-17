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

function viewportHeight () {
  return Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
}

function populateAsyncUserVideoChannels (authService: AuthService, channel: any[]) {
  return new Promise(res => {
    authService.userInformationLoaded
      .subscribe(
        () => {
          const user = authService.getUser()
          if (!user) return

          const videoChannels = user.videoChannels
          if (Array.isArray(videoChannels) === false) return

          videoChannels.forEach(c => channel.push({ id: c.id, label: c.displayName }))

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

function isInSmallView () {
  return window.innerWidth < 600
}

function isInMobileView () {
  return window.innerWidth < 500
}

// Thanks: https://gist.github.com/ghinda/8442a57f22099bdb2e34
function objectToFormData (obj: any, form?: FormData, namespace?: string) {
  let fd = form || new FormData()
  let formKey

  for (let key of Object.keys(obj)) {
    if (namespace) formKey = `${namespace}[${key}]`
    else formKey = key

    if (obj[key] === undefined) continue

    if (typeof obj[ key ] === 'object' && !(obj[ key ] instanceof File)) {
      objectToFormData(obj[ key ], fd, key)
    } else {
      fd.append(formKey, obj[ key ])
    }
  }

  return fd
}

export {
  viewportHeight,
  getParameterByName,
  populateAsyncUserVideoChannels,
  getAbsoluteAPIUrl,
  dateToHuman,
  isInSmallView,
  isInMobileView,
  immutableAssign,
  objectToFormData
}
