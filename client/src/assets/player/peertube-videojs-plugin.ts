// Big thanks to: https://github.com/kmoskwiak/videojs-resolution-switcher

import * as videojs from 'video.js'
import * as WebTorrent from 'webtorrent'
import { VideoConstant, VideoResolution } from '../../../../shared/models/videos'
import { VideoFile } from '../../../../shared/models/videos/video.model'
import { renderVideo } from './video-renderer'

declare module 'video.js' {
  interface Player {
    peertube (): PeerTubePlugin
  }
}

interface VideoJSComponentInterface {
  _player: videojs.Player

  new (player: videojs.Player, options?: any)

  registerComponent (name: string, obj: any)
}

type PeertubePluginOptions = {
  videoFiles: VideoFile[]
  playerElement: HTMLVideoElement
  videoViewUrl: string
  videoDuration: number
}

// https://github.com/danrevah/ngx-pipes/blob/master/src/pipes/math/bytes.ts
// Don't import all Angular stuff, just copy the code with shame
const dictionaryBytes: Array<{max: number, type: string}> = [
  { max: 1024, type: 'B' },
  { max: 1048576, type: 'KB' },
  { max: 1073741824, type: 'MB' },
  { max: 1.0995116e12, type: 'GB' }
]
function bytes (value) {
  const format = dictionaryBytes.find(d => value < d.max) || dictionaryBytes[dictionaryBytes.length - 1]
  const calc = Math.floor(value / (format.max / 1024)).toString()

  return [ calc, format.type ]
}

// videojs typings don't have some method we need
const videojsUntyped = videojs as any
const webtorrent = new WebTorrent({
  tracker: {
    rtcConfig: {
      iceServers: [
        {
          urls: 'stun:stun.stunprotocol.org'
        },
        {
          urls: 'stun:stun.framasoft.org'
        }
      ]
    }
  },
  dht: false
})

const MenuItem: VideoJSComponentInterface = videojsUntyped.getComponent('MenuItem')
class ResolutionMenuItem extends MenuItem {

  constructor (player: videojs.Player, options) {
    options.selectable = true
    super(player, options)

    const currentResolutionId = this.player_.peertube().getCurrentResolutionId()
    this.selected(this.options_.id === currentResolutionId)
  }

  handleClick (event) {
    super.handleClick(event)

    this.player_.peertube().updateResolution(this.options_.id)
  }
}
MenuItem.registerComponent('ResolutionMenuItem', ResolutionMenuItem)

const MenuButton: VideoJSComponentInterface = videojsUntyped.getComponent('MenuButton')
class ResolutionMenuButton extends MenuButton {
  label: HTMLElement

  constructor (player: videojs.Player, options) {
    options.label = 'Quality'
    super(player, options)

    this.label = document.createElement('span')

    this.el().setAttribute('aria-label', 'Quality')
    this.controlText('Quality')

    videojsUntyped.dom.addClass(this.label, 'vjs-resolution-button-label')
    this.el().appendChild(this.label)

    player.peertube().on('videoFileUpdate', () => this.update())
  }

  createItems () {
    const menuItems = []
    for (const videoFile of this.player_.peertube().videoFiles) {
      menuItems.push(new ResolutionMenuItem(
        this.player_,
        {
          id: videoFile.resolution.id,
          label: videoFile.resolution.label,
          src: videoFile.magnetUri,
          selected: videoFile.resolution.id === this.currentSelectionId
        })
      )
    }

    return menuItems
  }

  update () {
    if (!this.label) return

    this.label.innerHTML = this.player_.peertube().getCurrentResolutionLabel()
    this.hide()
    return super.update()
  }

  buildCSSClass () {
    return super.buildCSSClass() + ' vjs-resolution-button'
  }
}
MenuButton.registerComponent('ResolutionMenuButton', ResolutionMenuButton)

const Button: VideoJSComponentInterface = videojsUntyped.getComponent('Button')
class PeerTubeLinkButton extends Button {

  createEl () {
    const link = document.createElement('a')
    link.href = window.location.href.replace('embed', 'watch')
    link.innerHTML = 'PeerTube'
    link.title = 'Go to the video page'
    link.className = 'vjs-peertube-link'
    link.target = '_blank'

    return link
  }

  handleClick () {
    this.player_.pause()
  }
}
Button.registerComponent('PeerTubeLinkButton', PeerTubeLinkButton)

class WebTorrentButton extends Button {
  createEl () {
    const div = document.createElement('div')
    const subDivWebtorrent = document.createElement('div')
    div.appendChild(subDivWebtorrent)

    const downloadIcon = document.createElement('span')
    downloadIcon.classList.add('icon', 'icon-download')
    subDivWebtorrent.appendChild(downloadIcon)

    const downloadSpeedText = document.createElement('span')
    downloadSpeedText.classList.add('download-speed-text')
    const downloadSpeedNumber = document.createElement('span')
    downloadSpeedNumber.classList.add('download-speed-number')
    const downloadSpeedUnit = document.createElement('span')
    downloadSpeedText.appendChild(downloadSpeedNumber)
    downloadSpeedText.appendChild(downloadSpeedUnit)
    subDivWebtorrent.appendChild(downloadSpeedText)

    const uploadIcon = document.createElement('span')
    uploadIcon.classList.add('icon', 'icon-upload')
    subDivWebtorrent.appendChild(uploadIcon)

    const uploadSpeedText = document.createElement('span')
    uploadSpeedText.classList.add('upload-speed-text')
    const uploadSpeedNumber = document.createElement('span')
    uploadSpeedNumber.classList.add('upload-speed-number')
    const uploadSpeedUnit = document.createElement('span')
    uploadSpeedText.appendChild(uploadSpeedNumber)
    uploadSpeedText.appendChild(uploadSpeedUnit)
    subDivWebtorrent.appendChild(uploadSpeedText)

    const peersText = document.createElement('span')
    peersText.classList.add('peers-text')
    const peersNumber = document.createElement('span')
    peersNumber.classList.add('peers-number')
    subDivWebtorrent.appendChild(peersNumber)
    subDivWebtorrent.appendChild(peersText)

    div.className = 'vjs-peertube'
    // Hide the stats before we get the info
    subDivWebtorrent.className = 'vjs-peertube-hidden'

    const subDivHttp = document.createElement('div')
    subDivHttp.className = 'vjs-peertube-hidden'
    const subDivHttpText = document.createElement('span')
    subDivHttpText.classList.add('peers-number')
    subDivHttpText.textContent = 'HTTP'
    const subDivFallbackText = document.createElement('span')
    subDivFallbackText.classList.add('peers-text')
    subDivFallbackText.textContent = ' fallback'

    subDivHttp.appendChild(subDivHttpText)
    subDivHttp.appendChild(subDivFallbackText)
    div.appendChild(subDivHttp)

    this.player_.peertube().on('torrentInfo', (event, data) => {
      // We are in HTTP fallback
      if (!data) {
        subDivHttp.className = 'vjs-peertube-displayed'
        subDivWebtorrent.className = 'vjs-peertube-hidden'

        return
      }

      const downloadSpeed = bytes(data.downloadSpeed)
      const uploadSpeed = bytes(data.uploadSpeed)
      const numPeers = data.numPeers

      downloadSpeedNumber.textContent = downloadSpeed[ 0 ]
      downloadSpeedUnit.textContent = ' ' + downloadSpeed[ 1 ]

      uploadSpeedNumber.textContent = uploadSpeed[ 0 ]
      uploadSpeedUnit.textContent = ' ' + uploadSpeed[ 1 ]

      peersNumber.textContent = numPeers
      peersText.textContent = ' peers'

      subDivHttp.className = 'vjs-peertube-hidden'
      subDivWebtorrent.className = 'vjs-peertube-displayed'
    })

    return div
  }
}
Button.registerComponent('WebTorrentButton', WebTorrentButton)

const Plugin: VideoJSComponentInterface = videojsUntyped.getPlugin('plugin')
class PeerTubePlugin extends Plugin {
  private player: any
  private currentVideoFile: VideoFile
  private playerElement: HTMLVideoElement
  private videoFiles: VideoFile[]
  private torrent: WebTorrent.Torrent
  private autoplay = false
  private videoViewUrl: string
  private videoDuration: number
  private videoViewInterval
  private torrentInfoInterval
  private savePlayerSrcFunction: Function

  constructor (player: videojs.Player, options: PeertubePluginOptions) {
    super(player, options)

    // Fix canplay event on google chrome by disabling default videojs autoplay
    this.autoplay = this.player.options_.autoplay
    this.player.options_.autoplay = false

    this.videoFiles = options.videoFiles
    this.videoViewUrl = options.videoViewUrl
    this.videoDuration = options.videoDuration

    this.savePlayerSrcFunction = this.player.src
    // Hack to "simulate" src link in video.js >= 6
    // Without this, we can't play the video after pausing it
    // https://github.com/videojs/video.js/blob/master/src/js/player.js#L1633
    this.player.src = () => true

    this.playerElement = options.playerElement

    this.player.ready(() => {
      this.initializePlayer()
      this.runTorrentInfoScheduler()
      this.runViewAdd()
    })
  }

  dispose () {
    clearInterval(this.videoViewInterval)
    clearInterval(this.torrentInfoInterval)

    // Don't need to destroy renderer, video player will be destroyed
    this.flushVideoFile(this.currentVideoFile, false)
  }

  getCurrentResolutionId () {
    return this.currentVideoFile ? this.currentVideoFile.resolution.id : -1
  }

  getCurrentResolutionLabel () {
    return this.currentVideoFile ? this.currentVideoFile.resolution.label : ''
  }

  updateVideoFile (videoFile?: VideoFile, done?: () => void) {
    if (done === undefined) {
      done = () => { /* empty */ }
    }

    // Pick the first one
    if (videoFile === undefined) {
      videoFile = this.videoFiles[0]
    }

    // Don't add the same video file once again
    if (this.currentVideoFile !== undefined && this.currentVideoFile.magnetUri === videoFile.magnetUri) {
      return
    }

    // Do not display error to user because we will have multiple fallbacks
    this.disableErrorDisplay()

    this.player.src = () => true
    this.player.playbackRate(1)

    const previousVideoFile = this.currentVideoFile
    this.currentVideoFile = videoFile

    this.addTorrent(this.currentVideoFile.magnetUri, previousVideoFile, done)

    this.trigger('videoFileUpdate')
  }

  addTorrent (magnetOrTorrentUrl: string, previousVideoFile: VideoFile, done: Function) {
    console.log('Adding ' + magnetOrTorrentUrl + '.')

    this.torrent = webtorrent.add(magnetOrTorrentUrl, torrent => {
      console.log('Added ' + magnetOrTorrentUrl + '.')

      this.flushVideoFile(previousVideoFile)

      const options = { autoplay: true, controls: true }
      renderVideo(torrent.files[0], this.playerElement, options,(err, renderer) => {
        this.renderer = renderer

        if (err) return this.fallbackToHttp()

        if (!this.player.paused()) {
          const playPromise = this.player.play()
          if (playPromise !== undefined) return playPromise.then(done)

          return done()
        }

        return done()
      })
    })

    this.torrent.on('error', err => this.handleError(err))

    this.torrent.on('warning', (err: any) => {
      // We don't support HTTP tracker but we don't care -> we use the web socket tracker
      if (err.message.indexOf('Unsupported tracker protocol') !== -1) return

      // Users don't care about issues with WebRTC, but developers do so log it in the console
      if (err.message.indexOf('Ice connection failed') !== -1) {
        console.error(err)
        return
      }

      // Magnet hash is not up to date with the torrent file, add directly the torrent file
      if (err.message.indexOf('incorrect info hash') !== -1) {
        console.error('Incorrect info hash detected, falling back to torrent file.')
        return this.addTorrent(this.torrent['xs'], previousVideoFile, done)
      }

      return this.handleError(err)
    })
  }

  updateResolution (resolutionId: number) {
    // Remember player state
    const currentTime = this.player.currentTime()
    const isPaused = this.player.paused()

    // Remove poster to have black background
    this.playerElement.poster = ''

    // Hide bigPlayButton
    if (!isPaused) {
      this.player.bigPlayButton.hide()
    }

    const newVideoFile = this.videoFiles.find(f => f.resolution.id === resolutionId)
    this.updateVideoFile(newVideoFile, () => {
      this.player.currentTime(currentTime)
      this.player.handleTechSeeked_()
    })
  }

  flushVideoFile (videoFile: VideoFile, destroyRenderer = true) {
    if (videoFile !== undefined && webtorrent.get(videoFile.magnetUri)) {
      if (destroyRenderer === true && this.renderer && this.renderer.destroy) this.renderer.destroy()

      webtorrent.remove(videoFile.magnetUri)
      console.log('Removed ' + videoFile.magnetUri)
    }
  }

  setVideoFiles (files: VideoFile[], videoViewUrl: string, videoDuration: number) {
    this.videoViewUrl = videoViewUrl
    this.videoDuration = videoDuration
    this.videoFiles = files

    // Re run view add for the new video
    this.runViewAdd()
    this.updateVideoFile(undefined, () => this.player.play())
  }

  private initializePlayer () {
    if (this.autoplay === true) {
      this.updateVideoFile(undefined, () => this.player.play())
    } else {
      this.player.one('play', () => {
        this.player.pause()
        this.updateVideoFile(undefined, () => this.player.play())
      })
    }
  }

  private runTorrentInfoScheduler () {
    this.torrentInfoInterval = setInterval(() => {
      // Not initialized yet
      if (this.torrent === undefined) return

      // Http fallback
      if (this.torrent === null) return this.trigger('torrentInfo', false)

      return this.trigger('torrentInfo', {
        downloadSpeed: this.torrent.downloadSpeed,
        numPeers: this.torrent.numPeers,
        uploadSpeed: this.torrent.uploadSpeed
      })
    }, 1000)
  }

  private runViewAdd () {
    this.clearVideoViewInterval()

    // After 30 seconds (or 3/4 of the video), add a view to the video
    let minSecondsToView = 30

    if (this.videoDuration < minSecondsToView) minSecondsToView = (this.videoDuration * 3) / 4

    let secondsViewed = 0
    this.videoViewInterval = setInterval(() => {
      if (this.player && !this.player.paused()) {
        secondsViewed += 1

        if (secondsViewed > minSecondsToView) {
          this.clearVideoViewInterval()

          this.addViewToVideo().catch(err => console.error(err))
        }
      }
    }, 1000)
  }

  private clearVideoViewInterval () {
    if (this.videoViewInterval !== undefined) {
      clearInterval(this.videoViewInterval)
      this.videoViewInterval = undefined
    }
  }

  private addViewToVideo () {
    return fetch(this.videoViewUrl, { method: 'POST' })
  }

  private fallbackToHttp () {
    this.flushVideoFile(this.currentVideoFile, true)
    this.torrent = null

    // Enable error display now this is our last fallback
    this.player.one('error', () => this.enableErrorDisplay())

    const httpUrl = this.currentVideoFile.fileUrl
    this.player.src = this.savePlayerSrcFunction
    this.player.src(httpUrl)
    this.player.play()
  }

  private handleError (err: Error | string) {
    return this.player.trigger('customError', { err })
  }

  private enableErrorDisplay () {
    this.player.addClass('vjs-error-display-enabled')
  }

  private disableErrorDisplay () {
    this.player.removeClass('vjs-error-display-enabled')
  }
}
videojsUntyped.registerPlugin('peertube', PeerTubePlugin)
