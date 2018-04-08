import './embed.scss'

import * as videojs from 'video.js'

import { VideoDetails } from '../../../../shared'
import { getVideojsOptions } from '../../assets/player/peertube-player'

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
    const videoContainerId = 'video-container'

    const videoElement = document.getElementById(videoContainerId) as HTMLVideoElement
    let autoplay = false
    let startTime = 0

    try {
      let params = new URL(window.location.toString()).searchParams
      autoplay = params.has('autoplay') && (params.get('autoplay') === '1' || params.get('autoplay') === 'true')

      const startTimeParamString = params.get('start')
      const startTimeParamNumber = parseInt(startTimeParamString, 10)
      if (isNaN(startTimeParamNumber) === false) startTime = startTimeParamNumber
    } catch (err) {
      console.error('Cannot get params from URL.', err)
    }

    const videojsOptions = getVideojsOptions({
      autoplay,
      inactivityTimeout: 1500,
      videoViewUrl: getVideoUrl(videoId) + '/views',
      playerElement: videoElement,
      videoFiles: videoInfo.files,
      videoDuration: videoInfo.duration,
      enableHotkeys: true,
      peertubeLink: true,
      poster: window.location.origin + videoInfo.previewPath,
      startTime
    })
    videojs(videoContainerId, videojsOptions, function () {
      const player = this

      player.dock({
        title: videoInfo.name,
        description: 'Uses P2P, others may know you are watching this video.'
      })
    })
  })
  .catch(err => console.error(err))
