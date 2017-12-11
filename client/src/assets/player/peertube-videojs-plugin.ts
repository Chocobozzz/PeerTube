// Big thanks to: https://github.com/kmoskwiak/videojs-resolution-switcher

import videojs, { Player } from 'video.js'
import * as WebTorrent from 'webtorrent'
import { VideoFile } from '../../../../shared'

import { renderVideo } from './video-renderer'

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
const webtorrent = new WebTorrent({ dht: false })

const MenuItem = videojsUntyped.getComponent('MenuItem')
const ResolutionMenuItem = videojsUntyped.extend(MenuItem, {
  constructor: function (player: Player, options) {
    options.selectable = true
    MenuItem.call(this, player, options)

    const currentResolution = this.player_.getCurrentResolution()
    this.selected(this.options_.id === currentResolution)
  },

  handleClick: function (event) {
    MenuItem.prototype.handleClick.call(this, event)
    this.player_.updateResolution(this.options_.id)
  }
})
MenuItem.registerComponent('ResolutionMenuItem', ResolutionMenuItem)

const MenuButton = videojsUntyped.getComponent('MenuButton')
const ResolutionMenuButton = videojsUntyped.extend(MenuButton, {
  constructor: function (player, options) {
    this.label = document.createElement('span')
    options.label = 'Quality'

    MenuButton.call(this, player, options)
    this.el().setAttribute('aria-label', 'Quality')
    this.controlText('Quality')

    videojsUntyped.dom.addClass(this.label, 'vjs-resolution-button-label')
    this.el().appendChild(this.label)

    player.on('videoFileUpdate', videojs.bind(this, this.update))
  },

  createItems: function () {
    const menuItems = []
    for (const videoFile of this.player_.videoFiles) {
      menuItems.push(new ResolutionMenuItem(
        this.player_,
        {
          id: videoFile.resolution,
          label: videoFile.resolutionLabel,
          src: videoFile.magnetUri,
          selected: videoFile.resolution === this.currentSelection
        })
      )
    }

    return menuItems
  },

  update: function () {
    this.label.innerHTML = this.player_.getCurrentResolutionLabel()
    this.hide()
    return MenuButton.prototype.update.call(this)
  },

  buildCSSClass: function () {
    return MenuButton.prototype.buildCSSClass.call(this) + ' vjs-resolution-button'
  }
})
MenuButton.registerComponent('ResolutionMenuButton', ResolutionMenuButton)

const Button = videojsUntyped.getComponent('Button')
const PeertubeLinkButton = videojsUntyped.extend(Button, {
  constructor: function (player) {
    Button.call(this, player)
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
    this.player_.pause()
  }
})
Button.registerComponent('PeerTubeLinkButton', PeertubeLinkButton)

const WebTorrentButton = videojsUntyped.extend(Button, {
  constructor: function (player) {
    Button.call(this, player)
  },

  createEl: function () {
    const div = document.createElement('div')
    const subDiv = document.createElement('div')
    div.appendChild(subDiv)

    const downloadIcon = document.createElement('span')
    downloadIcon.classList.add('icon', 'icon-download')
    subDiv.appendChild(downloadIcon)

    const downloadSpeedText = document.createElement('span')
    downloadSpeedText.classList.add('download-speed-text')
    const downloadSpeedNumber = document.createElement('span')
    downloadSpeedNumber.classList.add('download-speed-number')
    const downloadSpeedUnit = document.createElement('span')
    downloadSpeedText.appendChild(downloadSpeedNumber)
    downloadSpeedText.appendChild(downloadSpeedUnit)
    subDiv.appendChild(downloadSpeedText)

    const uploadIcon = document.createElement('span')
    uploadIcon.classList.add('icon', 'icon-upload')
    subDiv.appendChild(uploadIcon)

    const uploadSpeedText = document.createElement('span')
    uploadSpeedText.classList.add('upload-speed-text')
    const uploadSpeedNumber = document.createElement('span')
    uploadSpeedNumber.classList.add('upload-speed-number')
    const uploadSpeedUnit = document.createElement('span')
    uploadSpeedText.appendChild(uploadSpeedNumber)
    uploadSpeedText.appendChild(uploadSpeedUnit)
    subDiv.appendChild(uploadSpeedText)

    const peersText = document.createElement('span')
    peersText.textContent = ' peers'
    peersText.classList.add('peers-text')
    const peersNumber = document.createElement('span')
    peersNumber.classList.add('peers-number')
    subDiv.appendChild(peersNumber)
    subDiv.appendChild(peersText)

    div.className = 'vjs-webtorrent'
    // Hide the stats before we get the info
    subDiv.className = 'vjs-webtorrent-hidden'

    this.player_.on('torrentInfo', (event, data) => {
      const downloadSpeed = bytes(data.downloadSpeed)
      const uploadSpeed = bytes(data.uploadSpeed)
      const numPeers = data.numPeers

      downloadSpeedNumber.textContent = downloadSpeed[0]
      downloadSpeedUnit.textContent = ' ' + downloadSpeed[1]

      uploadSpeedNumber.textContent = uploadSpeed[0]
      uploadSpeedUnit.textContent = ' ' + uploadSpeed[1]

      peersNumber.textContent = numPeers

      subDiv.className = 'vjs-webtorrent-displayed'
    })

    return div
  }
})
Button.registerComponent('WebTorrentButton', WebTorrentButton)

type PeertubePluginOptions = {
  videoFiles: VideoFile[]
  playerElement: HTMLVideoElement
  autoplay: boolean
  peerTubeLink: boolean
}
const peertubePlugin = function (options: PeertubePluginOptions) {
  const player = this
  let currentVideoFile: VideoFile = undefined
  const playerElement = options.playerElement
  player.videoFiles = options.videoFiles

  // Hack to "simulate" src link in video.js >= 6
  // Without this, we can't play the video after pausing it
  // https://github.com/videojs/video.js/blob/master/src/js/player.js#L1633
  player.src = function () {
    return true
  }

  player.getCurrentResolution = function () {
    return currentVideoFile ? currentVideoFile.resolution : -1
  }

  player.getCurrentResolutionLabel = function () {
    return currentVideoFile ? currentVideoFile.resolutionLabel : ''
  }

  player.updateVideoFile = function (videoFile: VideoFile, done: () => void) {
    if (done === undefined) {
      done = () => { /* empty */ }
    }

    // Pick the first one
    if (videoFile === undefined) {
      videoFile = player.videoFiles[0]
    }

    // Don't add the same video file once again
    if (currentVideoFile !== undefined && currentVideoFile.magnetUri === videoFile.magnetUri) {
      return
    }

    const previousVideoFile = currentVideoFile
    currentVideoFile = videoFile

    console.log('Adding ' + videoFile.magnetUri + '.')
    player.torrent = webtorrent.add(videoFile.magnetUri, torrent => {
      console.log('Added ' + videoFile.magnetUri + '.')

      this.flushVideoFile(previousVideoFile)

      const options = { autoplay: true, controls: true }
      renderVideo(torrent.files[0], playerElement, options,(err, renderer) => {
        if (err) return handleError(err)

        this.renderer = renderer
        player.play()

        return done()
      })
    })

    player.torrent.on('error', err => handleError(err))
    player.torrent.on('warning', err => {
      // We don't support HTTP tracker but we don't care -> we use the web socket tracker
      if (err.message.indexOf('Unsupported tracker protocol: http') !== -1) return
      // Users don't care about issues with WebRTC, but developers do so log it in the console
      if (err.message.indexOf('Ice connection failed') !== -1) {
        console.error(err)
        return
      }

      return handleError(err)
    })

    player.trigger('videoFileUpdate')

    return player
  }

  player.updateResolution = function (resolution) {
    // Remember player state
    const currentTime = player.currentTime()
    const isPaused = player.paused()

    // Hide bigPlayButton
    if (!isPaused && this.player_.options_.bigPlayButton) {
      this.player_.bigPlayButton.hide()
    }

    const newVideoFile = player.videoFiles.find(f => f.resolution === resolution)
    player.updateVideoFile(newVideoFile, () => {
      player.currentTime(currentTime)
      player.handleTechSeeked_()
    })
  }

  player.flushVideoFile = function (videoFile: VideoFile, destroyRenderer = true) {
    if (videoFile !== undefined && webtorrent.get(videoFile.magnetUri)) {
      if (destroyRenderer === true) this.renderer.destroy()
      webtorrent.remove(videoFile.magnetUri)
    }
  }

  player.ready(function () {
    const controlBar = player.controlBar

    const menuButton = new ResolutionMenuButton(player, options)
    const fullscreenElement = controlBar.fullscreenToggle.el()
    controlBar.resolutionSwitcher = controlBar.el().insertBefore(menuButton.el(), fullscreenElement)
    controlBar.resolutionSwitcher.dispose = function () {
      this.parentNode.removeChild(this)
    }

    player.dispose = function () {
      // Don't need to destroy renderer, video player will be destroyed
      player.flushVideoFile(currentVideoFile, false)
    }

    if (options.peerTubeLink === true) {
      const peerTubeLinkButton = new PeertubeLinkButton(player)
      controlBar.peerTubeLink = controlBar.el().insertBefore(peerTubeLinkButton.el(), fullscreenElement)

      controlBar.peerTubeLink.dispose = function () {
        this.parentNode.removeChild(this)
      }
    }

    const webTorrentButton = new WebTorrentButton(player)
    controlBar.webTorrent = controlBar.el().insertBefore(webTorrentButton.el(), controlBar.progressControl.el())
    controlBar.webTorrent.dispose = function () {
      this.parentNode.removeChild(this)
    }

    if (options.autoplay === true) {
      player.updateVideoFile()
    } else {
      player.one('play', () => {
        // Pause, we wait the video to load before
        player.pause()

        player.updateVideoFile(undefined, () => player.play())
      })
    }

    setInterval(() => {
      if (player.torrent !== undefined) {
        player.trigger('torrentInfo', {
          downloadSpeed: player.torrent.downloadSpeed,
          numPeers: player.torrent.numPeers,
          uploadSpeed: player.torrent.uploadSpeed
        })
      }
    }, 1000)
  })

  function handleError (err: Error | string) {
    return player.trigger('customError', { err })
  }
}

videojsUntyped.registerPlugin('peertube', peertubePlugin)
