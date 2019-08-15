import './embed.scss'

import { peertubeTranslate, ResultList, ServerConfig, VideoDetails } from '../../../../shared'
import { VideoJSCaption } from '../../assets/player/peertube-videojs-typings'
import { VideoCaption } from '../../../../shared/models/videos/caption/video-caption.model'
import {
  P2PMediaLoaderOptions,
  PeertubePlayerManager,
  PeertubePlayerManagerOptions,
  PlayerMode
} from '../../assets/player/peertube-player-manager'
import { VideoStreamingPlaylistType } from '../../../../shared/models/videos/video-streaming-playlist.type'
import { PeerTubeEmbedApi } from './embed-api'

export class PeerTubeEmbed {
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

  title: boolean
  warningTitle: boolean
  bigPlayBackgroundColor: string
  foregroundColor: string

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

  loadConfig (): Promise<Response> {
    return fetch('/api/v1/config')
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
      const params = new URL(window.location.toString()).searchParams

      this.autoplay = this.getParamToggle(params, 'autoplay', false)
      this.controls = this.getParamToggle(params, 'controls', true)
      this.muted = this.getParamToggle(params, 'muted', false)
      this.loop = this.getParamToggle(params, 'loop', false)
      this.title = this.getParamToggle(params, 'title', true)
      this.enableApi = this.getParamToggle(params, 'api', this.enableApi)
      this.warningTitle = this.getParamToggle(params, 'warningTitle', true)

      this.scope = this.getParamString(params, 'scope', this.scope)
      this.subtitle = this.getParamString(params, 'subtitle')
      this.startTime = this.getParamString(params, 'start')
      this.stopTime = this.getParamString(params, 'stop')

      this.bigPlayBackgroundColor = this.getParamString(params, 'bigPlayBackgroundColor')
      this.foregroundColor = this.getParamString(params, 'foregroundColor')

      this.mode = this.getParamString(params, 'mode') === 'p2p-media-loader' ? 'p2p-media-loader' : 'webtorrent'
    } catch (err) {
      console.error('Cannot get params from URL.', err)
    }
  }

  private async initCore () {
    const urlParts = window.location.pathname.split('/')
    const videoId = urlParts[ urlParts.length - 1 ]

    const [ serverTranslations, videoResponse, captionsResponse, configResponse ] = await Promise.all([
      PeertubePlayerManager.getServerTranslations(window.location.origin, navigator.language),
      this.loadVideoInfo(videoId),
      this.loadVideoCaptions(videoId),
      this.loadConfig()
    ])

    if (!videoResponse.ok) {
      if (videoResponse.status === 404) return this.videoNotFound(serverTranslations)

      return this.videoFetchError(serverTranslations)
    }

    const videoInfo: VideoDetails = await videoResponse.json()
    const videoCaptions = await this.buildCaptions(serverTranslations, captionsResponse)

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

    this.player = await PeertubePlayerManager.initialize(this.mode, options, player => this.player = player)
    this.player.on('customError', (event: any, data: any) => this.handleError(data.err, serverTranslations))

    window[ 'videojsPlayer' ] = this.player

    this.buildCSS()

    await this.buildDock(videoInfo, configResponse)

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

  private async buildDock (videoInfo: VideoDetails, configResponse: Response) {
    if (this.controls) {
      const title = this.title ? videoInfo.name : undefined

      const config: ServerConfig = await configResponse.json()
      const description = config.tracker.enabled && this.warningTitle
        ? '<span class="text">' + this.player.localize('Watching this video may reveal your IP address to others.') + '</span>'
        : undefined

      this.player.dock({
        title,
        description
      })
    }
  }

  private buildCSS () {
    const body = document.getElementById('custom-css')

    if (this.bigPlayBackgroundColor) {
      body.style.setProperty('--embedBigPlayBackgroundColor', this.bigPlayBackgroundColor)
    }

    if (this.foregroundColor) {
      body.style.setProperty('--embedForegroundColor', this.foregroundColor)
    }
  }

  private async buildCaptions (serverTranslations: any, captionsResponse: Response): Promise<VideoJSCaption[]> {
    if (captionsResponse.ok) {
      const { data } = (await captionsResponse.json()) as ResultList<VideoCaption>

      return data.map(c => ({
        label: peertubeTranslate(c.language.label, serverTranslations),
        language: c.language.id,
        src: window.location.origin + c.captionPath
      }))
    }

    return []
  }
}

PeerTubeEmbed.main()
  .catch(err => console.error('Cannot init embed.', err))
