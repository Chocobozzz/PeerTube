import './embed.scss'

import 'core-js/es6/symbol'
import 'core-js/es6/object'
import 'core-js/es6/function'
import 'core-js/es6/parse-int'
import 'core-js/es6/parse-float'
import 'core-js/es6/number'
import 'core-js/es6/math'
import 'core-js/es6/string'
import 'core-js/es6/date'
import 'core-js/es6/array'
import 'core-js/es6/regexp'
import 'core-js/es6/map'
import 'core-js/es6/weak-map'
import 'core-js/es6/set'

// For google bot that uses Chrome 41 and does not understand fetch
import 'whatwg-fetch'

import * as videojs from 'video.js'

import { VideoDetails } from '../../../../shared'
import { getVideojsOptions } from '../../assets/player/peertube-player'

function getVideoUrl (id: string) {
  return window.location.origin + '/api/v1/videos/' + id
}

function loadVideoInfo (videoId: string): Promise<Response> {
  return fetch(getVideoUrl(videoId))
}

function removeElement (element: HTMLElement) {
  element.parentElement.removeChild(element)
}

function displayError (videoElement: HTMLVideoElement, text: string) {
  // Remove video element
  removeElement(videoElement)

  document.title = 'Sorry - ' + text

  const errorBlock = document.getElementById('error-block')
  errorBlock.style.display = 'flex'

  const errorText = document.getElementById('error-content')
  errorText.innerHTML = text
}

function videoNotFound (videoElement: HTMLVideoElement) {
  const text = 'This video does not exist.'
  displayError(videoElement, text)
}

function videoFetchError (videoElement: HTMLVideoElement) {
  const text = 'We cannot fetch the video. Please try again later.'
  displayError(videoElement, text)
}

const urlParts = window.location.href.split('/')
const videoId = urlParts[urlParts.length - 1]

loadVideoInfo(videoId)
  .then(async response => {
    const videoContainerId = 'video-container'
    const videoElement = document.getElementById(videoContainerId) as HTMLVideoElement

    if (!response.ok) {
      if (response.status === 404) return videoNotFound(videoElement)

      return videoFetchError(videoElement)
    }

    const videoInfo: VideoDetails = await response.json()

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
