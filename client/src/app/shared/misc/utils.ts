// Thanks: https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript

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

          videoChannels.forEach(c => channel.push({ id: c.id, label: c.name }))

          return res()
        }
      )
  })
}

export {
  viewportHeight,
  getParameterByName,
  populateAsyncUserVideoChannels
}
