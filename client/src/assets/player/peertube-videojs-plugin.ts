// Big thanks to: https://github.com/kmoskwiak/videojs-resolution-switcher

import videojs, { Player } from 'video.js'
import * as WebTorrent from 'webtorrent'

import { renderVideo } from './video-renderer'
import { VideoFile } from '../../../../shared'

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
    Button.apply(this, arguments)
    this.player = player
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
    this.player.pause()
  }
})
Button.registerComponent('PeerTubeLinkButton', PeertubeLinkButton)

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

  function handleError (err: Error|string) {
    return player.trigger('customError', { err })
  }
}

videojsUntyped.registerPlugin('peertube', peertubePlugin)
