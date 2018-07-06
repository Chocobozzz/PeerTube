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

import * as vjs from 'video.js';
import * as Channel from 'jschannel';

import { VideoDetails } from '../../../../shared'
import { addContextMenu, getVideojsOptions, loadLocale } from '../../assets/player/peertube-player'

/**
 * Embed API exposes control of the embed player to the outside world via 
 * JSChannels and window.postMessage
 */
class PeerTubeEmbedApi {
  constructor(
    private embed : PeerTubeEmbed
  ) {
  }

  private get player() {
    return this.embed.player
  }

  private get element() {
    return this.embed.videoElement
  }

  public initialize() {
    this.constructChannel()
    this.setupStateTracking()

    // We're ready!

    this.notifyReady()
  }

  private constructChannel() {
    let channel = Channel.build({ window: window.parent, origin: '*', scope: this.embed.scope })
    
    channel.bind('play', (txn, params) => this.player.play())
    channel.bind('pause', (txn, params) => this.player.pause())
    channel.bind('seek', (txn, time) => this.player.currentTime(time))
    channel.bind('setVolume', (txn, value) => this.player.volume(value))
    channel.bind('isReady', (txn, params) => this.isReady)
    channel.bind('setResolution', (txn, resolutionId) => this.setResolution(resolutionId))
    channel.bind('getResolutions', (txn, params) => this.resolutions)
    channel.bind('setPlaybackRate', (txn, playbackRate) => this.player.playbackRate(playbackRate))
    channel.bind('getPlaybackRate', (txn, params) => this.player.playbackRate())
    channel.bind('getPlaybackRates', (txn, params) => this.embed.playerOptions.playbackRates)

    this.channel = channel
  }

  private channel : Channel.MessagingChannel
  private isReady = false

  private setResolution(resolutionId : number) {
    if (resolutionId === -1 && this.player.peertube().isAutoResolutionForbidden()) 
      return

    // Auto resolution
    if (resolutionId === -1) {
      this.player.peertube().enableAutoResolution()
      return
    }

    this.player.peertube().disableAutoResolution()
    this.player.peertube().updateResolution(resolutionId)
  }

  /**
   * Let the host know that we're ready to go!
   */
  private notifyReady() {
    this.isReady = true
    this.channel.notify({ method: 'ready', params: true })
  }

  private setupStateTracking() {
    
    let currentState : 'playing' | 'paused' | 'unstarted' = 'unstarted'

    setInterval(() => {
      let position = this.element.currentTime;
      let volume = this.element.volume;

      this.channel.notify({
        method: 'playbackStatusUpdate',
        params: {
          position,
          volume,
          playbackState: currentState,
        }
      })
    }, 500)

    this.element.addEventListener('play', ev => {
      currentState = 'playing'
      this.channel.notify({ method: 'playbackStatusChange', params: 'playing' });
    })

    this.element.addEventListener('pause', ev => {
      currentState = 'paused'
      this.channel.notify({ method: 'playbackStatusChange', params: 'paused' });
    })

    // PeerTube specific capabilities

    this.player.peertube().on('autoResolutionUpdate', () => this.loadResolutions())
    this.player.peertube().on('videoFileUpdate', () => this.loadResolutions())
  }

  private resolutions = null

  private loadResolutions() {
    let resolutions = []
    let currentResolutionId = this.player.peertube().getCurrentResolutionId()

    for (const videoFile of this.player.peertube().videoFiles) {
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

class PeerTubeEmbed {
  constructor(
    private videoContainerId : string
  ) {
    this.videoElement = document.getElementById(videoContainerId) as HTMLVideoElement
  }

  public videoElement : HTMLVideoElement
  public player : any
  public playerOptions : any

  static async main() {
    const videoContainerId = 'video-container'
    const embed = new PeerTubeEmbed(videoContainerId);
    await embed.init();
  }
  
  getVideoUrl (id: string) {
    return window.location.origin + '/api/v1/videos/' + id
  }

  loadVideoInfo (videoId: string): Promise<Response> {
    return fetch(this.getVideoUrl(videoId))
  }

  removeElement (element: HTMLElement) {
    element.parentElement.removeChild(element)
  }

  displayError (videoElement: HTMLVideoElement, text: string) {
    // Remove video element
    this.removeElement(videoElement)

    document.title = 'Sorry - ' + text

    const errorBlock = document.getElementById('error-block')
    errorBlock.style.display = 'flex'

    const errorText = document.getElementById('error-content')
    errorText.innerHTML = text
  }

  videoNotFound (videoElement: HTMLVideoElement) {
    const text = 'This video does not exist.'
    this.displayError(videoElement, text)
  }

  videoFetchError (videoElement: HTMLVideoElement) {
    const text = 'We cannot fetch the video. Please try again later.'
    this.displayError(videoElement, text)
  }

  getParamToggle (params: URLSearchParams, name: string, defaultValue: boolean) {
    return params.has(name) ? (params.get(name) === '1' || params.get(name) === 'true') : defaultValue
  }

  getParamString (params: URLSearchParams, name: string, defaultValue: string) {
    return params.has(name) ? params.get(name) : defaultValue
  }

  private api : PeerTubeEmbedApi = null;

  private initializeApi() {
    if (!this.enableApi)
      return;

    this.api = new PeerTubeEmbedApi(this)
    this.api.initialize()
  }

  async init() {
    try {
      await this.initCore();
    } catch (e) {
      console.error(e);
    }
  }

  autoplay : boolean = false;
  controls : boolean = true;
  muted : boolean = false;
  loop : boolean = false;
  enableApi : boolean = false;
  startTime : number = 0;
  scope : string = 'peertube';

  private loadParams() {
    try {
      let params = new URL(window.location.toString()).searchParams

      this.autoplay = this.getParamToggle(params, 'autoplay', this.autoplay)
      this.controls = this.getParamToggle(params, 'controls', this.controls)
      this.muted = this.getParamToggle(params, 'muted', this.muted)
      this.loop = this.getParamToggle(params, 'loop', this.loop)
      this.enableApi = this.getParamToggle(params, 'api', this.enableApi)
      this.scope = this.getParamString(params, 'scope', this.scope);

      const startTimeParamString = params.get('start')
      const startTimeParamNumber = parseInt(startTimeParamString, 10)
      if (isNaN(startTimeParamNumber) === false) 
        this.startTime = startTimeParamNumber
    } catch (err) {
      console.error('Cannot get params from URL.', err)
    }
  }

  async initCore() {
    const urlParts = window.location.href.split('/')
    const lastPart = urlParts[urlParts.length - 1]
    const videoId = lastPart.indexOf('?') === -1 ? lastPart : lastPart.split('?')[0]

    await loadLocale(window.location.origin, vjs, navigator.language);
    let response = await this.loadVideoInfo(videoId);

    if (!response.ok) {
      if (response.status === 404) 
        return this.videoNotFound(this.videoElement)

      return this.videoFetchError(this.videoElement)
    }

    const videoInfo: VideoDetails = await response.json()

    this.loadParams();

    const videojsOptions = getVideojsOptions({
      autoplay: this.autoplay,
      controls: this.controls,
      muted: this.muted,
      loop: this.loop,
      startTime : this.startTime,

      inactivityTimeout: 1500,
      videoViewUrl: this.getVideoUrl(videoId) + '/views',
      playerElement: this.videoElement,
      videoFiles: videoInfo.files,
      videoDuration: videoInfo.duration,
      enableHotkeys: true,
      peertubeLink: true,
      poster: window.location.origin + videoInfo.previewPath,
      theaterMode: false
    })

    this.playerOptions = videojsOptions
    this.player = vjs(this.videoContainerId, videojsOptions, () => {

      window['videojsPlayer'] = this.player;

      if (this.controls) {
        (this.player as any).dock({
          title: videoInfo.name,
          description: this.player.localize('Uses P2P, others may know your IP is downloading this video.')
        })
      }
      addContextMenu(this.player, window.location.origin + videoInfo.embedPath)
      this.initializeApi();
    })
  }
}

PeerTubeEmbed.main()
