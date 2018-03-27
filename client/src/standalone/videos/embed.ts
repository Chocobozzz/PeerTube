import './embed.scss'

import * as videojs from 'video.js'
import 'videojs-hotkeys'
import '../../assets/player/peertube-videojs-plugin'
import 'videojs-dock/dist/videojs-dock.es.js'
import { VideoDetails } from '../../../../shared'

function getVideoUrl (id: string) {
  return window.location.origin + '/api/v1/videos/' + id
}

async function loadVideoInfo (videoId: string): Promise<VideoDetails> {
  const response = await fetch(getVideoUrl(videoId))
  return response.json()
}

const urlParts = window.location.href.split('/')
const videoId = urlParts[urlParts.length - 1]

loadVideoInfo(videoId)
  .then(videoInfo => {
    const videoElement = document.getElementById('video-container') as HTMLVideoElement
    const previewUrl = window.location.origin + videoInfo.previewPath
    videoElement.poster = previewUrl

    let autoplay = false

    try {
      let params = new URL(window.location.toString()).searchParams
      autoplay = params.has('autoplay') && (params.get('autoplay') === '1' || params.get('autoplay') === 'true')
    } catch (err) {
      console.error('Cannot get params from URL.', err)
    }

    const videojsOptions = {
      controls: true,
      autoplay,
      inactivityTimeout: 500,
      plugins: {
        peertube: {
          videoFiles: videoInfo.files,
          playerElement: videoElement,
          videoViewUrl: getVideoUrl(videoId) + '/views',
          videoDuration: videoInfo.duration
        },
        hotkeys: {
          enableVolumeScroll: false
        }
      },
      controlBar: {
        children: [
          'playToggle',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'liveDisplay',

          'flexibleWidthSpacer',
          'progressControl',

          'webTorrentButton',

          'muteToggle',
          'volumeControl',

          'resolutionMenuButton',
          'peerTubeLinkButton',

          'fullscreenToggle'
        ]
      }
    }
    videojs('video-container', videojsOptions, function () {
      const player = this

      player.dock({
        title: videoInfo.name,
        description: 'Uses P2P, others may know you are watching this video.'
      })
    })
  })
  .catch(err => console.error(err))
