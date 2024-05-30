import * as Channel from 'jschannel'
import { logger } from '../../root-helpers'
import { PeerTubeResolution, PeerTubeTextTrack } from '../embed-player-api/definitions'
import { PeerTubeEmbed } from './embed'
import './embed.scss'

/**
 * Embed API exposes control of the embed player to the outside world via
 * JSChannels and window.postMessage
 */
export class PeerTubeEmbedApi {
  private channel: Channel.MessagingChannel
  private isReady = false
  private resolutions: PeerTubeResolution[] = []

  private videoElPlayListener: () => void
  private videoElPauseListener: () => void
  private videoElEndedListener: () => void
  private videoElInterval: any

  constructor (private readonly embed: PeerTubeEmbed) {

  }

  initialize () {
    this.constructChannel()
  }

  initWithVideo () {
    this.disposeStateTracking()
    this.setupStateTracking()

    if (!this.isReady) {
      this.notifyReady()
    }
  }

  private get player () {
    return this.embed.player
  }

  private constructChannel () {
    const channel = Channel.build({ window: window.parent, origin: '*', scope: this.embed.getScope() })

    channel.bind('setVideoPassword', (txn, value) => this.embed.setVideoPasswordByAPI(value))

    channel.bind('play', (txn, params) => this.player.play())
    channel.bind('pause', (txn, params) => this.player.pause())
    channel.bind('seek', (txn, time) => this.player.currentTime(time))

    channel.bind('setVolume', (txn, value) => this.player.volume(value))
    channel.bind('getVolume', (txn, value) => this.player.volume())

    channel.bind('isReady', (txn, params) => this.isReady)

    channel.bind('setResolution', (txn, resolutionId) => this.setResolution(resolutionId))
    channel.bind('getResolutions', (txn, params) => this.resolutions)

    channel.bind('getCaptions', (txn, params) => this.getCaptions())
    channel.bind('setCaption', (txn, id) => this.setCaption(id))

    channel.bind('setPlaybackRate', (txn, playbackRate) => this.player.playbackRate(playbackRate))
    channel.bind('getPlaybackRate', (txn, params) => this.player.playbackRate())
    channel.bind('getPlaybackRates', (txn, params) => this.player.options_.playbackRates)

    channel.bind('playNextVideo', (txn, params) => this.embed.playNextPlaylistVideo())
    channel.bind('playPreviousVideo', (txn, params) => this.embed.playPreviousPlaylistVideo())
    channel.bind('getCurrentPosition', (txn, params) => this.embed.getCurrentPlaylistPosition())

    channel.bind('getImageDataUrl', (txn, params) => this.embed.getImageDataUrl())

    this.channel = channel
  }

  private setResolution (resolutionId: number) {
    logger.info(`Set resolution ${resolutionId}`)

    if (this.isWebVideo() && resolutionId === -1) {
      logger.error('Auto resolution cannot be set in web video player mode')
      return
    }

    this.player.peertubeResolutions().select({ id: resolutionId, fireCallback: true })
  }

  private getCaptions (): PeerTubeTextTrack[] {
    return this.player.textTracks().tracks_.map(t => ({
      id: t.id,
      src: t.src,
      label: t.label,
      mode: t.mode
    }))
  }

  private setCaption (id: string) {
    const tracks = this.player.textTracks().tracks_

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

    this.videoElInterval = setInterval(() => {
      const position = this.player?.currentTime() ?? 0
      const volume = this.player?.volume()

      this.channel.notify({
        method: 'playbackStatusUpdate',
        params: {
          position,
          volume,
          duration: this.player?.duration(),
          playbackState: currentState
        }
      })
    }, 500)

    // ---------------------------------------------------------------------------

    this.videoElPlayListener = () => {
      currentState = 'playing'
      this.channel.notify({ method: 'playbackStatusChange', params: 'playing' })
    }
    this.player.on('play', this.videoElPlayListener)

    this.videoElPauseListener = () => {
      currentState = 'paused'
      this.channel.notify({ method: 'playbackStatusChange', params: 'paused' })
    }
    this.player.on('pause', this.videoElPauseListener)

    this.videoElEndedListener = () => {
      currentState = 'ended'
      this.channel.notify({ method: 'playbackStatusChange', params: 'ended' })
    }
    this.player.on('ended', this.videoElEndedListener)

    // ---------------------------------------------------------------------------

    // PeerTube specific capabilities
    this.player.peertubeResolutions().on('resolutions-added', () => this.loadResolutions())
    this.player.peertubeResolutions().on('resolutions-changed', () => this.loadResolutions())

    this.loadResolutions()

    this.player.on('volumechange', () => {
      this.channel.notify({
        method: 'volumeChange',
        params: this.player.volume()
      })
    })
  }

  private disposeStateTracking () {
    if (!this.player) return

    if (this.videoElPlayListener) this.player.off('play', this.videoElPlayListener)
    if (this.videoElPauseListener) this.player.off('pause', this.videoElPauseListener)
    if (this.videoElEndedListener) this.player.off('ended', this.videoElEndedListener)

    clearInterval(this.videoElInterval)
  }

  private loadResolutions () {
    this.resolutions = this.player.peertubeResolutions().getResolutions()
      .map(r => ({
        id: r.id,
        label: r.label,
        active: r.selected,
        width: r.width,
        height: r.height
      }))

    this.channel.notify({
      method: 'resolutionUpdate',
      params: this.resolutions
    })
  }

  private isWebVideo () {
    return !!this.player.webVideo
  }
}
