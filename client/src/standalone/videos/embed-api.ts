import './embed.scss'

import * as Channel from 'jschannel'
import { PeerTubeResolution } from '../player/definitions'
import { PeerTubeEmbed } from './embed'

/**
 * Embed API exposes control of the embed player to the outside world via
 * JSChannels and window.postMessage
 */
export class PeerTubeEmbedApi {
  private channel: Channel.MessagingChannel
  private isReady = false
  private resolutions: PeerTubeResolution[] = null

  constructor (private embed: PeerTubeEmbed) {
  }

  initialize () {
    this.constructChannel()
    this.setupStateTracking()

    // We're ready!

    this.notifyReady()
  }

  private get element () {
    return this.embed.videoElement
  }

  private constructChannel () {
    const channel = Channel.build({ window: window.parent, origin: '*', scope: this.embed.scope })

    channel.bind('play', (txn, params) => this.embed.player.play())
    channel.bind('pause', (txn, params) => this.embed.player.pause())
    channel.bind('seek', (txn, time) => this.embed.player.currentTime(time))
    channel.bind('setVolume', (txn, value) => this.embed.player.volume(value))
    channel.bind('getVolume', (txn, value) => this.embed.player.volume())
    channel.bind('isReady', (txn, params) => this.isReady)
    channel.bind('setResolution', (txn, resolutionId) => this.setResolution(resolutionId))
    channel.bind('getResolutions', (txn, params) => this.resolutions)
    channel.bind('setPlaybackRate', (txn, playbackRate) => this.embed.player.playbackRate(playbackRate))
    channel.bind('getPlaybackRate', (txn, params) => this.embed.player.playbackRate())
    channel.bind('getPlaybackRates', (txn, params) => this.embed.playerOptions.playbackRates)

    this.channel = channel
  }

  private setResolution (resolutionId: number) {
    if (resolutionId === -1 && this.embed.player.webtorrent().isAutoResolutionForbidden()) return

    // Auto resolution
    if (resolutionId === -1) {
      this.embed.player.webtorrent().enableAutoResolution()
      return
    }

    this.embed.player.webtorrent().disableAutoResolution()
    this.embed.player.webtorrent().updateResolution(resolutionId)
  }

  /**
   * Let the host know that we're ready to go!
   */
  private notifyReady () {
    this.isReady = true
    this.channel.notify({ method: 'ready', params: true })
  }

  private setupStateTracking () {
    let currentState: 'playing' | 'paused' | 'unstarted' = 'unstarted'

    setInterval(() => {
      const position = this.element.currentTime
      const volume = this.element.volume

      this.channel.notify({
        method: 'playbackStatusUpdate',
        params: {
          position,
          volume,
          playbackState: currentState
        }
      })
    }, 500)

    this.element.addEventListener('play', ev => {
      currentState = 'playing'
      this.channel.notify({ method: 'playbackStatusChange', params: 'playing' })
    })

    this.element.addEventListener('pause', ev => {
      currentState = 'paused'
      this.channel.notify({ method: 'playbackStatusChange', params: 'paused' })
    })

    // PeerTube specific capabilities

    if (this.embed.player.webtorrent) {
      this.embed.player.webtorrent().on('autoResolutionUpdate', () => this.loadWebTorrentResolutions())
      this.embed.player.webtorrent().on('videoFileUpdate', () => this.loadWebTorrentResolutions())
    }
  }

  private loadWebTorrentResolutions () {
    const resolutions = []
    const currentResolutionId = this.embed.player.webtorrent().getCurrentResolutionId()

    for (const videoFile of this.embed.player.webtorrent().videoFiles) {
      let label = videoFile.resolution.label
      if (videoFile.fps && videoFile.fps >= 50) {
        label += videoFile.fps
      }

      resolutions.push({
        id: videoFile.resolution.id,
        label,
        src: videoFile.magnetUri,
        active: videoFile.resolution.id === currentResolutionId
      })
    }

    this.resolutions = resolutions
    this.channel.notify({
      method: 'resolutionUpdate',
      params: this.resolutions
    })
  }
}
