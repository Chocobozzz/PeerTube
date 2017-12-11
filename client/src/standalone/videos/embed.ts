import './embed.scss'

import * as videojs from 'video.js'
import '../../assets/player/peertube-videojs-plugin'
import 'videojs-dock/dist/videojs-dock.es.js'
import { VideoDetails } from '../../../../shared'

function loadVideoInfo (videoId: string, callback: (err: Error, res?: VideoDetails) => void) {
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

const urlParts = window.location.href.split('/')
const videoId = urlParts[urlParts.length - 1]

loadVideoInfo(videoId, (err, videoInfo) => {
  if (err) {
    console.error(err)
    return
  }

  const videoElement = document.getElementById('video-container') as HTMLVideoElement
  const previewUrl = window.location.origin + videoInfo.previewPath
  videoElement.poster = previewUrl

  const videojsOptions = {
    controls: true,
    autoplay: false,
    plugins: {
      peertube: {
        videoFiles: videoInfo.files,
        playerElement: videoElement,
        autoplay: false,
        peerTubeLink: true
      }
    }
  }
  videojs('video-container', videojsOptions, function () {
    const player = this

    player.dock({
      title: videoInfo.name
    })
  })
})
