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

import * as Channel from 'jschannel'

import { peertubeTranslate, ResultList, VideoDetails } from '../../../../shared'
import { PeerTubeResolution } from '../player/definitions'
import { VideoJSCaption } from '../../assets/player/peertube-videojs-typings'
import { VideoCaption } from '../../../../shared/models/videos/caption/video-caption.model'
import {
  P2PMediaLoaderOptions,
  PeertubePlayerManager,
  PeertubePlayerManagerOptions,
  PlayerMode
} from '../../assets/player/peertube-player-manager'
import { VideoStreamingPlaylistType } from '../../../../shared/models/videos/video-streaming-playlist.type'

/**
 * Embed API exposes control of the embed player to the outside world via
 * JSChannels and window.postMessage
 */
class PeerTubeEmbedApi {
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
    let channel = Channel.build({ window: window.parent, origin: '*', scope: this.embed.scope })

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
      let position = this.element.currentTime
      let volume = this.element.volume

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
    let resolutions = []
    let currentResolutionId = this.embed.player.webtorrent().getCurrentResolutionId()

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

class PeerTubeEmbed {
  videoElement: HTMLVideoElement
  player: any
  playerOptions: any
  api: PeerTubeEmbedApi = null
  autoplay: boolean
  controls: boolean
  muted: boolean
  loop: boolean
  subtitle: string
  enableApi = false
  startTime: number | string = 0
  stopTime: number | string
  mode: PlayerMode
  scope = 'peertube'

  static async main () {
    const videoContainerId = 'video-container'
    const embed = new PeerTubeEmbed(videoContainerId)
    await embed.init()
  }

  constructor (private videoContainerId: string) {
    this.videoElement = document.getElementById(videoContainerId) as HTMLVideoElement
  }

  getVideoUrl (id: string) {
    return window.location.origin + '/api/v1/videos/' + id
  }

  loadVideoInfo (videoId: string): Promise<Response> {
    return fetch(this.getVideoUrl(videoId))
  }

  loadVideoCaptions (videoId: string): Promise<Response> {
    return fetch(this.getVideoUrl(videoId) + '/captions')
  }

  removeElement (element: HTMLElement) {
    element.parentElement.removeChild(element)
  }

  displayError (text: string, translations?: { [ id: string ]: string }) {
    // Remove video element
    if (this.videoElement) this.removeElement(this.videoElement)

    const translatedText = peertubeTranslate(text, translations)
    const translatedSorry = peertubeTranslate('Sorry', translations)

    document.title = translatedSorry + ' - ' + translatedText

    const errorBlock = document.getElementById('error-block')
    errorBlock.style.display = 'flex'

    const errorTitle = document.getElementById('error-title')
    errorTitle.innerHTML = peertubeTranslate('Sorry', translations)

    const errorText = document.getElementById('error-content')
    errorText.innerHTML = translatedText
  }

  videoNotFound (translations?: { [ id: string ]: string }) {
    const text = 'This video does not exist.'
    this.displayError(text, translations)
  }

  videoFetchError (translations?: { [ id: string ]: string }) {
    const text = 'We cannot fetch the video. Please try again later.'
    this.displayError(text, translations)
  }

  getParamToggle (params: URLSearchParams, name: string, defaultValue?: boolean) {
    return params.has(name) ? (params.get(name) === '1' || params.get(name) === 'true') : defaultValue
  }

  getParamString (params: URLSearchParams, name: string, defaultValue?: string) {
    return params.has(name) ? params.get(name) : defaultValue
  }

  async init () {
    try {
      await this.initCore()
    } catch (e) {
      console.error(e)
    }
  }

  private initializeApi () {
    if (!this.enableApi) return

    this.api = new PeerTubeEmbedApi(this)
    this.api.initialize()
  }

  private loadParams () {
    try {
      let params = new URL(window.location.toString()).searchParams

      this.autoplay = this.getParamToggle(params, 'autoplay')
      this.controls = this.getParamToggle(params, 'controls')
      this.muted = this.getParamToggle(params, 'muted')
      this.loop = this.getParamToggle(params, 'loop')
      this.enableApi = this.getParamToggle(params, 'api', this.enableApi)

      this.scope = this.getParamString(params, 'scope', this.scope)
      this.subtitle = this.getParamString(params, 'subtitle')
      this.startTime = this.getParamString(params, 'start')
      this.stopTime = this.getParamString(params, 'stop')

      this.mode = this.getParamString(params, 'mode') === 'p2p-media-loader' ? 'p2p-media-loader' : 'webtorrent'
    } catch (err) {
      console.error('Cannot get params from URL.', err)
    }
  }

  private async initCore () {
    const urlParts = window.location.pathname.split('/')
    const videoId = urlParts[ urlParts.length - 1 ]

    const [ serverTranslations, videoResponse, captionsResponse ] = await Promise.all([
      PeertubePlayerManager.getServerTranslations(window.location.origin, navigator.language),
      this.loadVideoInfo(videoId),
      this.loadVideoCaptions(videoId)
    ])

    if (!videoResponse.ok) {
      if (videoResponse.status === 404) return this.videoNotFound(serverTranslations)

      return this.videoFetchError(serverTranslations)
    }

    const videoInfo: VideoDetails = await videoResponse.json()
    let videoCaptions: VideoJSCaption[] = []
    if (captionsResponse.ok) {
      const { data } = (await captionsResponse.json()) as ResultList<VideoCaption>
      videoCaptions = data.map(c => ({
        label: peertubeTranslate(c.language.label, serverTranslations),
        language: c.language.id,
        src: window.location.origin + c.captionPath
      }))
    }

    this.loadParams()

    const options: PeertubePlayerManagerOptions = {
      common: {
        autoplay: this.autoplay,
        controls: this.controls,
        muted: this.muted,
        loop: this.loop,
        captions: videoCaptions.length !== 0,
        startTime: this.startTime,
        stopTime: this.stopTime,
        subtitle: this.subtitle,

        videoCaptions,
        inactivityTimeout: 1500,
        videoViewUrl: this.getVideoUrl(videoId) + '/views',

        playerElement: this.videoElement,
        onPlayerElementChange: (element: HTMLVideoElement) => this.videoElement = element,

        videoDuration: videoInfo.duration,
        enableHotkeys: true,
        peertubeLink: true,
        poster: window.location.origin + videoInfo.previewPath,
        theaterMode: false,

        serverUrl: window.location.origin,
        language: navigator.language,
        embedUrl: window.location.origin + videoInfo.embedPath
      },

      webtorrent: {
        videoFiles: videoInfo.files
      }
    }

    if (this.mode === 'p2p-media-loader') {
      const hlsPlaylist = videoInfo.streamingPlaylists.find(p => p.type === VideoStreamingPlaylistType.HLS)

      Object.assign(options, {
        p2pMediaLoader: {
          playlistUrl: hlsPlaylist.playlistUrl,
          segmentsSha256Url: hlsPlaylist.segmentsSha256Url,
          redundancyBaseUrls: hlsPlaylist.redundancies.map(r => r.baseUrl),
          trackerAnnounce: videoInfo.trackerUrls,
          videoFiles: videoInfo.files
        } as P2PMediaLoaderOptions
      })
    }

    this.player = await PeertubePlayerManager.initialize(this.mode, options)

    this.player.on('customError', (event: any, data: any) => this.handleError(data.err, serverTranslations))

    window[ 'videojsPlayer' ] = this.player

    if (this.controls) {
      this.player.dock({
        title: videoInfo.name,
        description: this.player.localize('Uses P2P, others may know your IP is downloading this video.')
      })
    }

    this.initializeApi()
  }

  private handleError (err: Error, translations?: { [ id: string ]: string }) {
    if (err.message.indexOf('from xs param') !== -1) {
      this.player.dispose()
      this.videoElement = null
      this.displayError('This video is not available because the remote instance is not responding.', translations)
      return
    }
  }
}

PeerTubeEmbed.main()
  .catch(err => console.error('Cannot init embed.', err))
