import './embed.scss'

import * as Channel from 'jschannel'
import { PeerTubeResolution, PeerTubeTextTrack } from '../player/definitions'
import { PeerTubeEmbed } from './embed'

/**
 * Embed API exposes control of the embed player to the outside world via
 * JSChannels and window.postMessage
 */
export class PeerTubeEmbedApi {
  private channel: Channel.MessagingChannel
  private isReady = false
  private resolutions: PeerTubeResolution[] = []

  constructor (private embed: PeerTubeEmbed) {
  }

  initialize () {
    this.constructChannel()
    this.setupStateTracking()

    // We're ready!

    this.notifyReady()
  }

  private get element () {
    return this.embed.playerElement
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

    channel.bind('getCaptions', (txn, params) => this.getCaptions())
    channel.bind('setCaption', (txn, id) => this.setCaption(id)),

    channel.bind('setPlaybackRate', (txn, playbackRate) => this.embed.player.playbackRate(playbackRate))
    channel.bind('getPlaybackRate', (txn, params) => this.embed.player.playbackRate())
    channel.bind('getPlaybackRates', (txn, params) => this.embed.player.options_.playbackRates)

    channel.bind('playNextVideo', (txn, params) => this.embed.playNextVideo())
    channel.bind('playPreviousVideo', (txn, params) => this.embed.playPreviousVideo())
    channel.bind('getCurrentPosition', (txn, params) => this.embed.getCurrentPosition())
    this.channel = channel
  }

  private setResolution (resolutionId: number) {
    console.log('set resolution %d', resolutionId)

    if (this.isWebtorrent()) {
      if (resolutionId === -1 && this.embed.player.webtorrent().isAutoResolutionPossible() === false) return

      // Auto resolution
      if (resolutionId === -1) {
        this.embed.player.webtorrent().enableAutoResolution()
        return
      }

      this.embed.player.webtorrent().disableAutoResolution()
      this.embed.player.webtorrent().updateResolution(resolutionId)

      return
    }

    this.embed.player.p2pMediaLoader().getHLSJS().nextLevel = resolutionId
  }

  private getCaptions (): PeerTubeTextTrack[] {
    return this.embed.player.textTracks().tracks_.map(t => {
      return {
        id: t.id,
        src: t.src,
        label: t.label,
        mode: t.mode as any
      }
    })
  }

  private setCaption (id: string) {
    const tracks = this.embed.player.textTracks().tracks_

    for (const track of tracks) {
      if (track.id === id) track.mode = 'showing'
      else track.mode = 'disabled'
    }
  }

  /**
   * Let the host know that we're ready to go!
   */
  private notifyReady () {
    this.isReady = true
    this.channel.notify({ method: 'ready', params: true })
  }

  private setupStateTracking () {
    let currentState: 'playing' | 'paused' | 'unstarted' | 'ended' = 'unstarted'

    setInterval(() => {
      const position = this.element.currentTime
      const volume = this.element.volume

      this.channel.notify({
        method: 'playbackStatusUpdate',
        params: {
          position,
          volume,
          duration: this.embed.player.duration(),
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

    this.element.addEventListener('ended', ev => {
      currentState = 'ended'
      this.channel.notify({ method: 'playbackStatusChange', params: 'ended' })
    })

    // PeerTube specific capabilities

    if (this.isWebtorrent()) {
      this.embed.player.webtorrent().on('autoResolutionUpdate', () => this.loadWebTorrentResolutions())
      this.embed.player.webtorrent().on('videoFileUpdate', () => this.loadWebTorrentResolutions())
    } else {
      this.embed.player.p2pMediaLoader().on('resolutionChange', () => this.loadP2PMediaLoaderResolutions())
    }

    this.embed.player.on('volumechange', () => {
      this.channel.notify({
        method: 'volumeChange',
        params: this.embed.player.volume()
      })
    })
  }

  private loadWebTorrentResolutions () {
    this.resolutions = []

    const currentResolutionId = this.embed.player.webtorrent().getCurrentResolutionId()

    for (const videoFile of this.embed.player.webtorrent().videoFiles) {
      let label = videoFile.resolution.label
      if (videoFile.fps && videoFile.fps >= 50) {
        label += videoFile.fps
      }

      this.resolutions.push({
        id: videoFile.resolution.id,
        label,
        src: videoFile.magnetUri,
        active: videoFile.resolution.id === currentResolutionId,
        height: videoFile.resolution.id
      })
    }

    this.channel.notify({
      method: 'resolutionUpdate',
      params: this.resolutions
    })
  }

  private loadP2PMediaLoaderResolutions () {
    this.resolutions = []

    const qualityLevels = this.embed.player.qualityLevels()
    const currentResolutionId = this.embed.player.qualityLevels().selectedIndex

    for (let i = 0; i < qualityLevels.length; i++) {
      const level = qualityLevels[i]

      this.resolutions.push({
        id: level.id,
        label: level.height + 'p',
        active: level.id === currentResolutionId,
        width: level.width,
        height: level.height
      })
    }

    this.channel.notify({
      method: 'resolutionUpdate',
      params: this.resolutions
    })
  }

  private isWebtorrent () {
    return this.embed.player.webtorrent
  }
}
