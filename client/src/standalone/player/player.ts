import * as Channel from 'jschannel'
import { EventHandler, PeerTubeResolution, PeerTubeTextTrack, PlayerEventType } from './definitions'
import { EventRegistrar } from './events'

const PASSTHROUGH_EVENTS = [
  'pause',
  'play',
  'playbackStatusUpdate',
  'playbackStatusChange',
  'resolutionUpdate',
  'volumeChange'
]

/**
 * Allows for programmatic control of a PeerTube embed running in an <iframe>
 * within a web page.
 */
export class PeerTubePlayer {

  private eventRegistrar: EventRegistrar = new EventRegistrar()
  private channel: Channel.MessagingChannel
  private readyPromise: Promise<void>

  /**
   * Construct a new PeerTubePlayer for the given PeerTube embed iframe.
   * Optionally provide a `scope` to ensure that messages are not crossed
   * between multiple PeerTube embeds. The string passed here must match the
   * `scope=` query parameter on the embed URL.
   *
   * @param embedElement
   * @param scope
   */
  constructor (
    private embedElement: HTMLIFrameElement,
    private scope?: string
  ) {
    this.eventRegistrar.registerTypes(PASSTHROUGH_EVENTS)

    this.constructChannel()
    this.prepareToBeReady()
  }

  /**
   * Destroy the player object and remove the associated player from the DOM.
   */
  destroy () {
    this.embedElement.remove()
  }

  /**
   * Listen to an event emitted by this player.
   *
   * @param event One of the supported event types
   * @param handler A handler which will be passed an event object (or undefined if no event object is included)
   */
  addEventListener (event: PlayerEventType, handler: EventHandler<any>): boolean {
    return this.eventRegistrar.addListener(event, handler)
  }

  /**
   * Remove an event listener previously added with addEventListener().
   *
   * @param event The name of the event previously listened to
   * @param handler
   */
  removeEventListener (event: PlayerEventType, handler: EventHandler<any>): boolean {
    return this.eventRegistrar.removeListener(event, handler)
  }

  /**
   * Promise resolves when the player is ready.
   */
  get ready (): Promise<void> {
    return this.readyPromise
  }

  /**
   * Tell the embed to start/resume playback
   */
  async play () {
    await this.sendMessage('play')
  }

  /**
   * Tell the embed to pause playback.
   */
  async pause () {
    await this.sendMessage('pause')
  }

  /**
   * Tell the embed to change the audio volume
   * @param value A number from 0 to 1
   */
  async setVolume (value: number) {
    await this.sendMessage('setVolume', value)
  }

  /**
   * Get the current volume level in the embed.
   * @param value A number from 0 to 1
   */
  async getVolume (): Promise<number> {
    return this.sendMessage<void, number>('getVolume')
  }

  /**
   * Tell the embed to change the current caption
   * @param value Caption id
   */
  async setCaption (value: string) {
    await this.sendMessage('setCaption', value)
  }

  /**
   * Get video captions
   */
  async getCaptions (): Promise<PeerTubeTextTrack[]> {
    return this.sendMessage<void, PeerTubeTextTrack[]>('getCaptions')
  }

  /**
   * Tell the embed to seek to a specific position (in seconds)
   * @param seconds
   */
  async seek (seconds: number) {
    await this.sendMessage('seek', seconds)
  }

  /**
   * Tell the embed to switch resolutions to the resolution identified
   * by the given ID.
   *
   * @param resolutionId The ID of the resolution as found with getResolutions()
   */
  async setResolution (resolutionId: any) {
    await this.sendMessage('setResolution', resolutionId)
  }

  /**
   * Retrieve a list of the available resolutions. This may change later, listen to the
   * `resolutionUpdate` event with `addEventListener` in order to be updated as the available
   * resolutions change.
   */
  async getResolutions (): Promise<PeerTubeResolution[]> {
    return this.sendMessage<void, PeerTubeResolution[]>('getResolutions')
  }

  /**
   * Retrieve a list of available playback rates.
   */
  async getPlaybackRates (): Promise<number[]> {
    return this.sendMessage<void, number[]>('getPlaybackRates')
  }

  /**
   * Get the current playback rate. Defaults to 1 (1x playback rate).
   */
  async getPlaybackRate (): Promise<number> {
    return this.sendMessage<void, number>('getPlaybackRate')
  }

  /**
   * Set the playback rate. Should be one of the options returned by getPlaybackRates().
   * Passing 0.5 means half speed, 1 means normal, 2 means 2x speed, etc.
   *
   * @param rate
   */
  async setPlaybackRate (rate: number) {
    await this.sendMessage('setPlaybackRate', rate)
  }

  /**
   * Play next video in playlist
   */
  async playNextVideo () {
    await this.sendMessage('playNextVideo')
  }

  /**
   * Play previous video in playlist
   */
  async playPreviousVideo () {
    await this.sendMessage('playPreviousVideo')
  }

  /**
   * Get video position currently played (starts from 1)
   */
  async getCurrentPosition () {
    return this.sendMessage<void, number>('getCurrentPosition')
  }

  private constructChannel () {
    this.channel = Channel.build({
      window: this.embedElement.contentWindow,
      origin: '*',
      scope: this.scope || 'peertube'
    })
    this.eventRegistrar.bindToChannel(this.channel)
  }

  private prepareToBeReady () {
    let readyResolve: Function
    let readyReject: Function

    this.readyPromise = new Promise<void>((res, rej) => {
      readyResolve = res
      readyReject = rej
    })

    this.channel.bind('ready', success => success ? readyResolve() : readyReject())
    this.channel.call({
      method: 'isReady',
      success: isReady => isReady ? readyResolve() : null
    })
  }

  private sendMessage<TIn, TOut> (method: string, params?: TIn): Promise<TOut> {
    return new Promise<TOut>((resolve, reject) => {
      this.channel.call({
        method, params,
        success: result => resolve(result),
        error: error => reject(error)
      })
    })
  }
}

// put it on the window as well as the export
(window[ 'PeerTubePlayer' ] as any) = PeerTubePlayer
