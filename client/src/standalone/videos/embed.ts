import './embed.scss'

import videojs from 'video.js'
import 'videojs-dock/dist/videojs-dock.es.js'
import * as WebTorrent from 'webtorrent'
import { Video } from '../../../../shared'

// videojs typings don't have some method we need
const videojsUntyped = videojs as any

function loadVideoInfos (videoId: string, callback: (err: Error, res?: Video) => void) {
  const xhttp = new XMLHttpRequest()
  xhttp.onreadystatechange = function () {
    if (this.readyState === 4 && this.status === 200) {
      const json = JSON.parse(this.responseText)
      return callback(null, json)
    }
  }

  xhttp.onerror = err => callback(err.error)

  const url = window.location.origin + '/api/v1/videos/' + videoId
  xhttp.open('GET', url, true)
  xhttp.send()
}

function loadVideoTorrent (magnetUri: string, player: videojs.Player) {
  console.log('Loading video ' + videoId)
  const client = new WebTorrent()

  console.log('Adding magnet ' + magnetUri)
  client.add(magnetUri, torrent => {
    const file = torrent.files[0]

    file.renderTo('video', err => {
      if (err) {
        console.error(err)
        return
      }

      // Hack to "simulate" src link in video.js >= 6
      // If no, we can't play the video after pausing it
      // https://github.com/videojs/video.js/blob/master/src/js/player.js#L1633
      (player as any).src = () => true

      player.play()
    })
  })
}

const urlParts = window.location.href.split('/')
const videoId = urlParts[urlParts.length - 1]

loadVideoInfos(videoId, (err, videoInfos) => {
  if (err) {
    console.error(err)
    return
  }

  const magnetUri = videoInfos.magnetUri
  const videoContainer = document.getElementById('video-container') as HTMLVideoElement
  const previewUrl = window.location.origin + videoInfos.previewPath
  videoContainer.poster = previewUrl

  videojs('video-container', { controls: true, autoplay: false }, function () {
    const player = this

    const Button = videojsUntyped.getComponent('Button')
    const peertubeLinkButton = videojsUntyped.extend(Button, {
      constructor: function () {
        Button.apply(this, arguments)
      },

      createEl: function () {
        const link = document.createElement('a')
        link.href = window.location.href.replace('embed', 'watch')
        link.innerHTML = 'PeerTube'
        link.title = 'Go to the video page'
        link.className = 'vjs-peertube-link'
        link.target = '_blank'

        return link
      },

      handleClick: function () {
        player.pause()
      }
    })
    videojsUntyped.registerComponent('PeerTubeLinkButton', peertubeLinkButton)

    const controlBar = player.getChild('controlBar')
    const addedLink = controlBar.addChild('PeerTubeLinkButton', {})
    controlBar.el().insertBefore(addedLink.el(), controlBar.fullscreenToggle.el())

    player.dock({
      title: videoInfos.name
    })

    document.querySelector('.vjs-big-play-button').addEventListener('click', () => {
      loadVideoTorrent(magnetUri, player)
    }, false)
  })
})
