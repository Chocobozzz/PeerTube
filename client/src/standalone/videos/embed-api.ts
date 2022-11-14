import './embed.scss'
import * as Channel from 'jschannel'
import { logger } from '../../root-helpers'
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

  private oldVideoElement: HTMLVideoElement
  private videoElPlayListener: () => void
  private videoElPauseListener: () => void
  private videoElEndedListener: () => void
  private videoElInterval: any

  constructor (private readonly embed: PeerTubeEmbed) {

  }

  initialize () {
    this.constructChannel()
    this.setupStateTracking()

    // We're ready!

    this.notifyReady()
  }

  reInit () {
    this.disposeStateTracking()
    this.setupStateTracking()
  }

  private get element () {
    return this.embed.getPlayerElement()
  }

  private constructChannel () {
    const channel = Channel.build({ window: window.parent, origin: '*', scope: this.embed.getScope() })

    channel.bind('play', (txn, params) => this.embed.player.play())
    channel.bind('pause', (txn, params) => this.embed.player.pause())
    channel.bind('seek', (txn, time) => this.embed.player.currentTime(time))

    channel.bind('setVolume', (txn, value) => this.embed.player.volume(value))
    channel.bind('getVolume', (txn, value) => this.embed.player.volume())

    channel.bind('isReady', (txn, params) => this.isReady)

    channel.bind('setResolution', (txn, resolutionId) => this.setResolution(resolutionId))
    channel.bind('getResolutions', (txn, params) => this.resolutions)

    channel.bind('getCaptions', (txn, params) => this.getCaptions())
    channel.bind('setCaption', (txn, id) => this.setCaption(id))

    channel.bind('setPlaybackRate', (txn, playbackRate) => this.embed.player.playbackRate(playbackRate))
    channel.bind('getPlaybackRate', (txn, params) => this.embed.player.playbackRate())
    channel.bind('getPlaybackRates', (txn, params) => this.embed.player.options_.playbackRates)

    channel.bind('playNextVideo', (txn, params) => this.embed.playNextPlaylistVideo())
    channel.bind('playPreviousVideo', (txn, params) => this.embed.playPreviousPlaylistVideo())
    channel.bind('getCurrentPosition', (txn, params) => this.embed.getCurrentPlaylistPosition())
    this.channel = channel
  }

  private setResolution (resolutionId: number) {
    logger.info(`Set resolution ${resolutionId}`)

    if (this.isWebtorrent()) {
      if (resolutionId === -1 && this.embed.player.webtorrent().isAutoResolutionPossible() === false) return

      this.embed.player.webtorrent().changeQuality(resolutionId)

      return
    }

    this.embed.player.p2pMediaLoader().getHLSJS().currentLevel = resolutionId
  }

  private getCaptions (): PeerTubeTextTrack[] {
    return this.embed.player.textTracks().tracks_.map(t => ({
      id: t.id,
      src: t.src,
      label: t.label,
      mode: t.mode
    }))
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

    this.videoElInterval = setInterval(() => {
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

    // ---------------------------------------------------------------------------

    this.videoElPlayListener = () => {
      currentState = 'playing'
      this.channel.notify({ method: 'playbackStatusChange', params: 'playing' })
    }
    this.element.addEventListener('play', this.videoElPlayListener)

    this.videoElPauseListener = () => {
      currentState = 'paused'
      this.channel.notify({ method: 'playbackStatusChange', params: 'paused' })
    }
    this.element.addEventListener('pause', this.videoElPauseListener)

    this.videoElEndedListener = () => {
      currentState = 'ended'
      this.channel.notify({ method: 'playbackStatusChange', params: 'ended' })
    }
    this.element.addEventListener('ended', this.videoElEndedListener)

    this.oldVideoElement = this.element

    // ---------------------------------------------------------------------------

    // PeerTube specific capabilities
    this.embed.player.peertubeResolutions().on('resolutionsAdded', () => this.loadResolutions())
    this.embed.player.peertubeResolutions().on('resolutionChanged', () => this.loadResolutions())

    this.loadResolutions()

    this.embed.player.on('volumechange', () => {
      this.channel.notify({
        method: 'volumeChange',
        params: this.embed.player.volume()
      })
    })
  }

  private disposeStateTracking () {
    if (!this.oldVideoElement) return

    this.oldVideoElement.removeEventListener('play', this.videoElPlayListener)
    this.oldVideoElement.removeEventListener('pause', this.videoElPauseListener)
    this.oldVideoElement.removeEventListener('ended', this.videoElEndedListener)

    clearInterval(this.videoElInterval)

    this.oldVideoElement = undefined
  }

  private loadResolutions () {
    this.resolutions = this.embed.player.peertubeResolutions().getResolutions()
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

  private isWebtorrent () {
    return !!this.embed.player.webtorrent
  }
}
