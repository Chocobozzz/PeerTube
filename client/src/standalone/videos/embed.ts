import './embed.scss'
import videojs from 'video.js'
import { objectToUrlEncoded, peertubeLocalStorage } from '@root-helpers/index'
import { Tokens } from '@root-helpers/users'
import { peertubeTranslate } from '../../../../shared/core-utils/i18n'
import {
  ResultList,
  ServerConfig,
  UserRefreshToken,
  VideoCaption,
  VideoDetails,
  VideoPlaylist,
  VideoPlaylistElement,
  VideoStreamingPlaylistType
} from '../../../../shared/models'
import { P2PMediaLoaderOptions, PeertubePlayerManagerOptions, PlayerMode } from '../../assets/player/peertube-player-manager'
import { VideoJSCaption } from '../../assets/player/peertube-videojs-typings'
import { TranslationsManager } from '../../assets/player/translations-manager'
import { PeerTubeEmbedApi } from './embed-api'

type Translations = { [ id: string ]: string }

export class PeerTubeEmbed {
  playerElement: HTMLVideoElement
  player: videojs.Player
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
  peertubeLink: boolean
  bigPlayBackgroundColor: string
  foregroundColor: string

  mode: PlayerMode
  scope = 'peertube'

  userTokens: Tokens
  headers = new Headers()
  LOCAL_STORAGE_OAUTH_CLIENT_KEYS = {
    CLIENT_ID: 'client_id',
    CLIENT_SECRET: 'client_secret'
  }

  private translationsPromise: Promise<{ [id: string]: string }>
  private configPromise: Promise<ServerConfig>
  private PeertubePlayerManagerModulePromise: Promise<any>

  private playlist: VideoPlaylist
  private playlistElements: VideoPlaylistElement[]
  private currentPlaylistElement: VideoPlaylistElement

  private wrapperElement: HTMLElement

  static async main () {
    const videoContainerId = 'video-wrapper'
    const embed = new PeerTubeEmbed(videoContainerId)
    await embed.init()
  }

  constructor (private videoWrapperId: string) {
    this.wrapperElement = document.getElementById(this.videoWrapperId)
  }

  getVideoUrl (id: string) {
    return window.location.origin + '/api/v1/videos/' + id
  }

  refreshFetch (url: string, options?: RequestInit) {
    return fetch(url, options)
      .then((res: Response) => {
        if (res.status !== 401) return res

        // 401 unauthorized is not catch-ed, but then-ed
        const error = res

        const refreshingTokenPromise = new Promise((resolve, reject) => {
          const clientId: string = peertubeLocalStorage.getItem(this.LOCAL_STORAGE_OAUTH_CLIENT_KEYS.CLIENT_ID)
          const clientSecret: string = peertubeLocalStorage.getItem(this.LOCAL_STORAGE_OAUTH_CLIENT_KEYS.CLIENT_SECRET)

          const headers = new Headers()
          headers.set('Content-Type', 'application/x-www-form-urlencoded')

          const data = {
            refresh_token: this.userTokens.refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
            response_type: 'code',
            grant_type: 'refresh_token'
          }

          fetch('/api/v1/users/token', {
            headers,
            method: 'POST',
            body: objectToUrlEncoded(data)
          }).then(res => res.json())
            .then((obj: UserRefreshToken) => {
              this.userTokens.accessToken = obj.access_token
              this.userTokens.refreshToken = obj.refresh_token
              this.userTokens.save()

              this.setHeadersFromTokens()

              resolve()
            })
            .catch((refreshTokenError: any) => {
              reject(refreshTokenError)
            })
        })

        return refreshingTokenPromise
          .catch(() => this.removeTokensFromHeaders())
          .then(() => fetch(url, {
            ...options,
            headers: this.headers
          }))
      })
  }

  getPlaylistUrl (id: string) {
    return window.location.origin + '/api/v1/video-playlists/' + id
  }

  loadVideoInfo (videoId: string): Promise<Response> {
    return this.refreshFetch(this.getVideoUrl(videoId), { headers: this.headers })
  }

  loadVideoCaptions (videoId: string): Promise<Response> {
    return this.refreshFetch(this.getVideoUrl(videoId) + '/captions', { headers: this.headers })
  }

  loadPlaylistInfo (playlistId: string): Promise<Response> {
    return this.refreshFetch(this.getPlaylistUrl(playlistId), { headers: this.headers })
  }

  loadPlaylistElements (playlistId: string, start = 0): Promise<Response> {
    const url = new URL(this.getPlaylistUrl(playlistId) + '/videos')
    url.search = new URLSearchParams({ start: '' + start, count: '100' }).toString()

    return this.refreshFetch(url.toString(), { headers: this.headers })
  }

  loadConfig (): Promise<ServerConfig> {
    return this.refreshFetch('/api/v1/config')
      .then(res => res.json())
  }

  removeElement (element: HTMLElement) {
    element.parentElement.removeChild(element)
  }

  displayError (text: string, translations?: Translations) {
    // Remove video element
    if (this.playerElement) {
      this.removeElement(this.playerElement)
      this.playerElement = undefined
    }

    const translatedText = peertubeTranslate(text, translations)
    const translatedSorry = peertubeTranslate('Sorry', translations)

    document.title = translatedSorry + ' - ' + translatedText

    const errorBlock = document.getElementById('error-block')
    errorBlock.style.display = 'flex'

    const errorTitle = document.getElementById('error-title')
    errorTitle.innerHTML = peertubeTranslate('Sorry', translations)

    const errorText = document.getElementById('error-content')
    errorText.innerHTML = translatedText

    this.wrapperElement.style.display = 'none'
  }

  videoNotFound (translations?: Translations) {
    const text = 'This video does not exist.'
    this.displayError(text, translations)
  }

  videoFetchError (translations?: Translations) {
    const text = 'We cannot fetch the video. Please try again later.'
    this.displayError(text, translations)
  }

  playlistNotFound (translations?: Translations) {
    const text = 'This playlist does not exist.'
    this.displayError(text, translations)
  }

  playlistFetchError (translations?: Translations) {
    const text = 'We cannot fetch the playlist. Please try again later.'
    this.displayError(text, translations)
  }

  getParamToggle (params: URLSearchParams, name: string, defaultValue?: boolean) {
    return params.has(name) ? (params.get(name) === '1' || params.get(name) === 'true') : defaultValue
  }

  getParamString (params: URLSearchParams, name: string, defaultValue?: string) {
    return params.has(name) ? params.get(name) : defaultValue
  }

  async playNextVideo () {
    const next = this.getNextPlaylistElement()
    if (!next) {
      console.log('Next element not found in playlist.')
      return
    }

    this.currentPlaylistElement = next

    return this.loadVideoAndBuildPlayer(this.currentPlaylistElement.video.uuid)
  }

  async playPreviousVideo () {
    const previous = this.getPreviousPlaylistElement()
    if (!previous) {
      console.log('Previous element not found in playlist.')
      return
    }

    this.currentPlaylistElement = previous

    await this.loadVideoAndBuildPlayer(this.currentPlaylistElement.video.uuid)
  }

  getCurrentPosition () {
    if (!this.currentPlaylistElement) return -1

    return this.currentPlaylistElement.position
  }

  async init () {
    try {
      this.userTokens = Tokens.load()
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

  private loadParams (video: VideoDetails) {
    try {
      const params = new URL(window.location.toString()).searchParams

      this.autoplay = this.getParamToggle(params, 'autoplay', false)
      this.controls = this.getParamToggle(params, 'controls', true)
      this.muted = this.getParamToggle(params, 'muted', undefined)
      this.loop = this.getParamToggle(params, 'loop', false)
      this.title = this.getParamToggle(params, 'title', true)
      this.enableApi = this.getParamToggle(params, 'api', this.enableApi)
      this.warningTitle = this.getParamToggle(params, 'warningTitle', true)
      this.peertubeLink = this.getParamToggle(params, 'peertubeLink', true)

      this.scope = this.getParamString(params, 'scope', this.scope)
      this.subtitle = this.getParamString(params, 'subtitle')
      this.startTime = this.getParamString(params, 'start')
      this.stopTime = this.getParamString(params, 'stop')

      this.bigPlayBackgroundColor = this.getParamString(params, 'bigPlayBackgroundColor')
      this.foregroundColor = this.getParamString(params, 'foregroundColor')

      const modeParam = this.getParamString(params, 'mode')

      if (modeParam) {
        if (modeParam === 'p2p-media-loader') this.mode = 'p2p-media-loader'
        else this.mode = 'webtorrent'
      } else {
        if (Array.isArray(video.streamingPlaylists) && video.streamingPlaylists.length !== 0) this.mode = 'p2p-media-loader'
        else this.mode = 'webtorrent'
      }
    } catch (err) {
      console.error('Cannot get params from URL.', err)
    }
  }

  private async loadAllPlaylistVideos (playlistId: string, baseResult: ResultList<VideoPlaylistElement>) {
    let elements = baseResult.data
    let total = baseResult.total
    let i = 0

    while (total > elements.length && i < 10) {
      const result = await this.loadPlaylistElements(playlistId, elements.length)

      const json = await result.json() as ResultList<VideoPlaylistElement>
      total = json.total

      elements = elements.concat(json.data)
      i++
    }

    if (i === 10) {
      console.error('Cannot fetch all playlists elements, there are too many!')
    }

    return elements
  }

  private async loadPlaylist (playlistId: string) {
    const playlistPromise = this.loadPlaylistInfo(playlistId)
    const playlistElementsPromise = this.loadPlaylistElements(playlistId)

    let playlistResponse: Response
    let isResponseOk: boolean

    try {
      playlistResponse = await playlistPromise
      isResponseOk = true
    } catch (err) {
      console.error(err)
      isResponseOk = false
    }

    if (!isResponseOk) {
      const serverTranslations = await this.translationsPromise

      if (playlistResponse?.status === 404) {
        this.playlistNotFound(serverTranslations)
        return undefined
      }

      this.playlistFetchError(serverTranslations)
      return undefined
    }

    return { playlistResponse, videosResponse: await playlistElementsPromise }
  }

  private async loadVideo (videoId: string) {
    const videoPromise = this.loadVideoInfo(videoId)

    let videoResponse: Response
    let isResponseOk: boolean

    try {
      videoResponse = await videoPromise
      isResponseOk = true
    } catch (err) {
      console.error(err)

      isResponseOk = false
    }

    if (!isResponseOk) {
      const serverTranslations = await this.translationsPromise

      if (videoResponse?.status === 404) {
        this.videoNotFound(serverTranslations)
        return undefined
      }

      this.videoFetchError(serverTranslations)
      return undefined
    }

    const captionsPromise = this.loadVideoCaptions(videoId)

    return { captionsPromise, videoResponse }
  }

  private async buildPlaylistManager () {
    const translations = await this.translationsPromise

    this.player.upnext({
      timeout: 10000, // 10s
      headText: peertubeTranslate('Up Next', translations),
      cancelText: peertubeTranslate('Cancel', translations),
      suspendedText: peertubeTranslate('Autoplay is suspended', translations),
      getTitle: () => this.nextVideoTitle(),
      next: () => this.playNextVideo(),
      condition: () => !!this.getNextPlaylistElement(),
      suspended: () => false
    })
  }

  private async loadVideoAndBuildPlayer (uuid: string) {
    const res = await this.loadVideo(uuid)
    if (res === undefined) return

    return this.buildVideoPlayer(res.videoResponse, res.captionsPromise)
  }

  private nextVideoTitle () {
    const next = this.getNextPlaylistElement()
    if (!next) return ''

    return next.video.name
  }

  private getNextPlaylistElement (position?: number): VideoPlaylistElement {
    if (!position) position = this.currentPlaylistElement.position + 1

    if (position > this.playlist.videosLength) {
      return undefined
    }

    const next = this.playlistElements.find(e => e.position === position)

    if (!next || !next.video) {
      return this.getNextPlaylistElement(position + 1)
    }

    return next
  }

  private getPreviousPlaylistElement (position?: number): VideoPlaylistElement {
    if (!position) position = this.currentPlaylistElement.position - 1

    if (position < 1) {
      return undefined
    }

    const prev = this.playlistElements.find(e => e.position === position)

    if (!prev || !prev.video) {
      return this.getNextPlaylistElement(position - 1)
    }

    return prev
  }

  private async buildVideoPlayer (videoResponse: Response, captionsPromise: Promise<Response>) {
    let alreadyHadPlayer = false

    if (this.player) {
      this.player.dispose()
      alreadyHadPlayer = true
    }

    this.playerElement = document.createElement('video')
    this.playerElement.className = 'video-js vjs-peertube-skin'
    this.playerElement.setAttribute('playsinline', 'true')
    this.wrapperElement.appendChild(this.playerElement)

    const videoInfoPromise = videoResponse.json()
      .then((videoInfo: VideoDetails) => {
        if (!alreadyHadPlayer) this.loadPlaceholder(videoInfo)

        return videoInfo
      })

    const [ videoInfoTmp, serverTranslations, captionsResponse, config, PeertubePlayerManagerModule ] = await Promise.all([
      videoInfoPromise,
      this.translationsPromise,
      captionsPromise,
      this.configPromise,
      this.PeertubePlayerManagerModulePromise
    ])

    const videoInfo: VideoDetails = videoInfoTmp

    const PeertubePlayerManager = PeertubePlayerManagerModule.PeertubePlayerManager
    const videoCaptions = await this.buildCaptions(serverTranslations, captionsResponse)

    this.loadParams(videoInfo)

    const playlistPlugin = this.currentPlaylistElement
      ? {
        elements: this.playlistElements,
        playlist: this.playlist,

        getCurrentPosition: () => this.currentPlaylistElement.position,

        onItemClicked: (videoPlaylistElement: VideoPlaylistElement) => {
          this.currentPlaylistElement = videoPlaylistElement

          this.loadVideoAndBuildPlayer(this.currentPlaylistElement.video.uuid)
            .catch(err => console.error(err))
        }
      }
      : undefined

    const options: PeertubePlayerManagerOptions = {
      common: {
        // Autoplay in playlist mode
        autoplay: alreadyHadPlayer ? true : this.autoplay,
        controls: this.controls,
        muted: this.muted,
        loop: this.loop,

        captions: videoCaptions.length !== 0,
        subtitle: this.subtitle,

        startTime: this.playlist ? this.currentPlaylistElement.startTimestamp : this.startTime,
        stopTime: this.playlist ? this.currentPlaylistElement.stopTimestamp : this.stopTime,

        nextVideo: this.playlist ? () => this.playNextVideo() : undefined,
        hasNextVideo: this.playlist ? () => !!this.getNextPlaylistElement() : undefined,

        previousVideo: this.playlist ? () => this.playPreviousVideo() : undefined,
        hasPreviousVideo: this.playlist ? () => !!this.getPreviousPlaylistElement() : undefined,

        playlist: playlistPlugin,

        videoCaptions,
        inactivityTimeout: 2500,
        videoViewUrl: this.getVideoUrl(videoInfo.uuid) + '/views',

        playerElement: this.playerElement,
        onPlayerElementChange: (element: HTMLVideoElement) => this.playerElement = element,

        videoDuration: videoInfo.duration,
        enableHotkeys: true,
        peertubeLink: this.peertubeLink,
        poster: window.location.origin + videoInfo.previewPath,
        theaterButton: false,

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
          videoFiles: hlsPlaylist.files
        } as P2PMediaLoaderOptions
      })
    }

    this.player = await PeertubePlayerManager.initialize(this.mode, options, (player: videojs.Player) => this.player = player)
    this.player.on('customError', (event: any, data: any) => this.handleError(data.err, serverTranslations))

    window[ 'videojsPlayer' ] = this.player

    this.buildCSS()

    await this.buildDock(videoInfo, config)

    this.initializeApi()

    this.removePlaceholder()

    if (this.isPlaylistEmbed()) {
      await this.buildPlaylistManager()

      this.player.playlist().updateSelected()

      this.player.on('stopped', () => {
        this.playNextVideo()
      })
    }
  }

  private async initCore () {
    if (this.userTokens) this.setHeadersFromTokens()

    this.configPromise = this.loadConfig()
    this.translationsPromise = TranslationsManager.getServerTranslations(window.location.origin, navigator.language)
    this.PeertubePlayerManagerModulePromise = import('../../assets/player/peertube-player-manager')

    let videoId: string

    if (this.isPlaylistEmbed()) {
      const playlistId = this.getResourceId()
      const res = await this.loadPlaylist(playlistId)
      if (!res) return undefined

      this.playlist = await res.playlistResponse.json()

      const playlistElementResult = await res.videosResponse.json()
      this.playlistElements = await this.loadAllPlaylistVideos(playlistId, playlistElementResult)

      const params = new URL(window.location.toString()).searchParams
      const playlistPositionParam = this.getParamString(params, 'playlistPosition')

      let position = 1

      if (playlistPositionParam) {
        position = parseInt(playlistPositionParam + '', 10)
      }

      this.currentPlaylistElement = this.playlistElements.find(e => e.position === position)
      if (!this.currentPlaylistElement || !this.currentPlaylistElement.video) {
        console.error('Current playlist element is not valid.', this.currentPlaylistElement)
        this.currentPlaylistElement = this.getNextPlaylistElement()
      }

      if (!this.currentPlaylistElement) {
        console.error('This playlist does not have any valid element.')
        const serverTranslations = await this.translationsPromise
        this.playlistFetchError(serverTranslations)
        return
      }

      videoId = this.currentPlaylistElement.video.uuid
    } else {
      videoId = this.getResourceId()
    }

    return this.loadVideoAndBuildPlayer(videoId)
  }

  private handleError (err: Error, translations?: { [ id: string ]: string }) {
    if (err.message.indexOf('from xs param') !== -1) {
      this.player.dispose()
      this.playerElement = null
      this.displayError('This video is not available because the remote instance is not responding.', translations)
      return
    }
  }

  private async buildDock (videoInfo: VideoDetails, config: ServerConfig) {
    if (!this.controls) return

    // On webtorrent fallback, player may have been disposed
    if (!this.player.player_) return

    const title = this.title ? videoInfo.name : undefined

    const description = config.tracker.enabled && this.warningTitle
      ? '<span class="text">' + peertubeTranslate('Watching this video may reveal your IP address to others.') + '</span>'
      : undefined

    this.player.dock({
      title,
      description
    })
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

  private loadPlaceholder (video: VideoDetails) {
    const placeholder = this.getPlaceholderElement()

    const url = window.location.origin + video.previewPath
    placeholder.style.backgroundImage = `url("${url}")`
    placeholder.style.display = 'block'
  }

  private removePlaceholder () {
    const placeholder = this.getPlaceholderElement()
    placeholder.style.display = 'none'
  }

  private getPlaceholderElement () {
    return document.getElementById('placeholder-preview')
  }

  private setHeadersFromTokens () {
    this.headers.set('Authorization', `${this.userTokens.tokenType} ${this.userTokens.accessToken}`)
  }

  private removeTokensFromHeaders () {
    this.headers.delete('Authorization')
  }

  private getResourceId () {
    const urlParts = window.location.pathname.split('/')
    return urlParts[ urlParts.length - 1 ]
  }

  private isPlaylistEmbed () {
    return window.location.pathname.split('/')[1] === 'video-playlists'
  }
}

PeerTubeEmbed.main()
  .catch(err => console.error('Cannot init embed.', err))
