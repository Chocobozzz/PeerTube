import './embed.scss'
import '../../assets/player/shared/dock/peertube-dock-component'
import '../../assets/player/shared/dock/peertube-dock-plugin'
import { PeerTubeServerError } from 'src/types'
import videojs from 'video.js'
import {
  HTMLServerConfig,
  ResultList,
  ServerErrorCode,
  VideoDetails,
  VideoPlaylist,
  VideoPlaylistElement,
  VideoState
} from '@peertube/peertube-models'
import { PeerTubePlayer } from '../../assets/player/peertube-player'
import { TranslationsManager } from '../../assets/player/translations-manager'
import { getParamString, logger, videoRequiresFileToken } from '../../root-helpers'
import { PeerTubeEmbedApi } from './embed-api'
import {
  AuthHTTP,
  LiveManager,
  PeerTubePlugin,
  PlayerOptionsBuilder,
  PlaylistFetcher,
  PlaylistTracker,
  Translations,
  VideoFetcher
} from './shared'
import { PlayerHTML } from './shared/player-html'

export class PeerTubeEmbed {
  player: videojs.Player
  api: PeerTubeEmbedApi = null

  config: HTMLServerConfig

  private translationsPromise: Promise<{ [id: string]: string }>
  private PeerTubePlayerManagerModulePromise: Promise<any>

  private readonly http: AuthHTTP
  private readonly videoFetcher: VideoFetcher
  private readonly playlistFetcher: PlaylistFetcher
  private readonly peertubePlugin: PeerTubePlugin
  private readonly playerHTML: PlayerHTML
  private readonly playerOptionsBuilder: PlayerOptionsBuilder
  private readonly liveManager: LiveManager

  private peertubePlayer: PeerTubePlayer

  private playlistTracker: PlaylistTracker

  private alreadyInitialized = false
  private alreadyPlayed = false

  private videoPassword: string
  private videoPasswordFromAPI: string
  private onVideoPasswordFromAPIResolver: (value: string) => void
  private requiresPassword: boolean

  constructor (videoWrapperId: string) {
    logger.registerServerSending(window.location.origin)

    this.http = new AuthHTTP()

    this.videoFetcher = new VideoFetcher(this.http)
    this.playlistFetcher = new PlaylistFetcher(this.http)
    this.peertubePlugin = new PeerTubePlugin(this.http)
    this.playerHTML = new PlayerHTML(videoWrapperId)
    this.playerOptionsBuilder = new PlayerOptionsBuilder(this.playerHTML, this.videoFetcher, this.peertubePlugin)
    this.liveManager = new LiveManager(this.playerHTML)
    this.requiresPassword = false

    try {
      this.config = JSON.parse((window as any)['PeerTubeServerConfig'])
    } catch (err) {
      logger.error('Cannot parse HTML config.', err)
    }
  }

  static async main () {
    const videoContainerId = 'video-wrapper'
    const embed = new PeerTubeEmbed(videoContainerId)
    await embed.init()
  }

  getScope () {
    return this.playerOptionsBuilder.getScope()
  }

  // ---------------------------------------------------------------------------

  async init () {
    this.translationsPromise = TranslationsManager.getServerTranslations(window.location.origin, navigator.language)
    this.PeerTubePlayerManagerModulePromise = import('../../assets/player/peertube-player')

    // Issue when we parsed config from HTML, fallback to API
    if (!this.config) {
      this.config = await this.http.fetch('/api/v1/config', { optionalAuth: false })
        .then(res => res.json())
    }

    const videoId = this.isPlaylistEmbed()
      ? await this.initPlaylist()
      : this.getResourceId()

    if (!videoId) return

    return this.loadVideoAndBuildPlayer({ uuid: videoId, forceAutoplay: false })
  }

  private async initPlaylist () {
    const playlistId = this.getResourceId()

    try {
      const res = await this.playlistFetcher.loadPlaylist(playlistId)

      const [ playlist, playlistElementResult ] = await Promise.all([
        res.playlistResponse.json() as Promise<VideoPlaylist>,
        res.videosResponse.json() as Promise<ResultList<VideoPlaylistElement>>
      ])

      const allPlaylistElements = await this.playlistFetcher.loadAllPlaylistVideos(playlistId, playlistElementResult)

      this.playlistTracker = new PlaylistTracker(playlist, allPlaylistElements)

      const params = new URL(window.location.toString()).searchParams
      const playlistPositionParam = getParamString(params, 'playlistPosition')

      const position = playlistPositionParam
        ? parseInt(playlistPositionParam + '', 10)
        : 1

      this.playlistTracker.setPosition(position)
    } catch (err) {
      this.playerHTML.displayError(err.message, await this.translationsPromise)
      return undefined
    }

    return this.playlistTracker.getCurrentElement().video.uuid
  }

  private initializeApi () {
    if (!this.playerOptionsBuilder.hasAPIEnabled()) return
    if (this.api) return

    this.api = new PeerTubeEmbedApi(this)
    this.api.initialize()
  }

  // ---------------------------------------------------------------------------

  setVideoPasswordByAPI (password: string) {
    logger.info('Setting password from API')

    this.videoPasswordFromAPI = password

    if (this.onVideoPasswordFromAPIResolver) {
      this.onVideoPasswordFromAPIResolver(password)
    }
  }

  private getPasswordByAPI () {
    if (this.videoPasswordFromAPI) return Promise.resolve(this.videoPasswordFromAPI)

    return new Promise<string>(res => {
      this.onVideoPasswordFromAPIResolver = res
    })
  }

  // ---------------------------------------------------------------------------

  async playNextPlaylistVideo () {
    const next = this.playlistTracker.getNextPlaylistElement()
    if (!next) {
      logger.info('Next element not found in playlist.')
      return
    }

    this.playlistTracker.setCurrentElement(next)

    return this.loadVideoAndBuildPlayer({ uuid: next.video.uuid, forceAutoplay: false })
  }

  async playPreviousPlaylistVideo () {
    const previous = this.playlistTracker.getPreviousPlaylistElement()
    if (!previous) {
      logger.info('Previous element not found in playlist.')
      return
    }

    this.playlistTracker.setCurrentElement(previous)

    await this.loadVideoAndBuildPlayer({ uuid: previous.video.uuid, forceAutoplay: false })
  }

  getCurrentPlaylistPosition () {
    return this.playlistTracker.getCurrentPosition()
  }

  // ---------------------------------------------------------------------------

  private async loadVideoAndBuildPlayer (options: {
    uuid: string
    forceAutoplay: boolean
  }) {
    const { uuid, forceAutoplay } = options

    this.playerOptionsBuilder.loadCommonParams()
    this.initializeApi()

    try {
      const {
        videoResponse,
        captionsPromise,
        chaptersPromise,
        storyboardsPromise
      } = await this.videoFetcher.loadVideo({ videoId: uuid, videoPassword: this.videoPassword })

      return this.buildVideoPlayer({ videoResponse, captionsPromise, chaptersPromise, storyboardsPromise, forceAutoplay })
    } catch (err) {

      if (await this.handlePasswordError(err)) this.loadVideoAndBuildPlayer({ ...options })
      else this.playerHTML.displayError(err.message, await this.translationsPromise)
    }
  }

  private async buildVideoPlayer (options: {
    videoResponse: Response
    storyboardsPromise: Promise<Response>
    captionsPromise: Promise<Response>
    chaptersPromise: Promise<Response>
    forceAutoplay: boolean
  }) {
    const { videoResponse, captionsPromise, chaptersPromise, storyboardsPromise, forceAutoplay } = options

    const videoInfoPromise = videoResponse.json()
      .then(async (videoInfo: VideoDetails) => {
        this.playerOptionsBuilder.loadVideoParams(this.config, videoInfo)

        const live = videoInfo.isLive
          ? await this.videoFetcher.loadLive(videoInfo)
          : undefined

        const videoFileToken = videoRequiresFileToken(videoInfo)
          ? await this.videoFetcher.loadVideoToken(videoInfo, this.videoPassword)
          : undefined

        return { live, video: videoInfo, videoFileToken }
      })

    const [
      { video, live, videoFileToken },
      translations,
      captionsResponse,
      chaptersResponse,
      storyboardsResponse
    ] = await Promise.all([
      videoInfoPromise,
      this.translationsPromise,
      captionsPromise,
      chaptersPromise,
      storyboardsPromise,
      this.buildPlayerIfNeeded()
    ])

    // If already played, we are in a playlist so we don't want to display the poster between videos
    if (!this.alreadyPlayed) {
      this.peertubePlayer.setPoster(window.location.origin + video.previewPath)
    }

    const playlist = this.playlistTracker
      ? {
        onVideoUpdate: (uuid: string) => this.loadVideoAndBuildPlayer({ uuid, forceAutoplay: false }),

        playlistTracker: this.playlistTracker,
        playNext: () => this.playNextPlaylistVideo(),
        playPrevious: () => this.playPreviousPlaylistVideo()
      }
      : undefined

    const loadOptions = await this.playerOptionsBuilder.getPlayerLoadOptions({
      video,
      captionsResponse,
      chaptersResponse,
      translations,

      storyboardsResponse,

      videoFileToken: () => videoFileToken,
      videoPassword: () => this.videoPassword,
      requiresPassword: this.requiresPassword,

      playlist,

      live,
      forceAutoplay,
      alreadyPlayed: this.alreadyPlayed
    })
    await this.peertubePlayer.load(loadOptions)

    if (!this.alreadyInitialized) {
      this.player = this.peertubePlayer.getPlayer();

      (window as any)['videojsPlayer'] = this.player

      this.buildCSS()

      if (this.api) this.api.initWithVideo()
    }

    this.alreadyInitialized = true

    this.player.one('play', () => {
      this.alreadyPlayed = true
    })

    if (this.videoPassword) this.playerHTML.removeVideoPasswordBlock()

    if (video.isLive) {
      this.liveManager.listenForChanges({
        video,
        onPublishedVideo: () => {
          this.liveManager.stopListeningForChanges(video)
          this.loadVideoAndBuildPlayer({ uuid: video.uuid, forceAutoplay: true })
        }
      })

      if (video.state.id === VideoState.WAITING_FOR_LIVE || video.state.id === VideoState.LIVE_ENDED) {
        this.liveManager.displayInfo({ state: video.state.id, translations })
        this.peertubePlayer.disable()
      } else {
        this.correctlyHandleLiveEnding(translations)
      }
    }

    this.peertubePlugin.getPluginsManager().runHook('action:embed.player.loaded', undefined, { player: this.player, videojs, video })
  }

  private buildCSS () {
    const body = document.getElementById('custom-css')

    if (this.playerOptionsBuilder.hasBigPlayBackgroundColor()) {
      body.style.setProperty('--embedBigPlayBackgroundColor', this.playerOptionsBuilder.getBigPlayBackgroundColor())
    }

    if (this.playerOptionsBuilder.hasForegroundColor()) {
      body.style.setProperty('--embedForegroundColor', this.playerOptionsBuilder.getForegroundColor())
    }
  }

  // ---------------------------------------------------------------------------

  private getResourceId () {
    const urlParts = window.location.pathname.split('/')
    return urlParts[urlParts.length - 1]
  }

  private isPlaylistEmbed () {
    return window.location.pathname.split('/')[1] === 'video-playlists'
  }

  // ---------------------------------------------------------------------------

  private correctlyHandleLiveEnding (translations: Translations) {
    this.player.one('ended', () => {
      // Display the live ended information
      this.liveManager.displayInfo({ state: VideoState.LIVE_ENDED, translations })

      this.peertubePlayer.disable()
    })
  }

  private async handlePasswordError (err: PeerTubeServerError) {
    let incorrectPassword: boolean = null
    if (err.serverCode === ServerErrorCode.VIDEO_REQUIRES_PASSWORD) incorrectPassword = false
    else if (err.serverCode === ServerErrorCode.INCORRECT_VIDEO_PASSWORD) incorrectPassword = true

    if (incorrectPassword === null) return false

    this.requiresPassword = true

    if (this.playerOptionsBuilder.mustWaitPasswordFromEmbedAPI()) {
      logger.info('Waiting for password from Embed API')

      const videoPasswordFromAPI = await this.getPasswordByAPI()

      if (videoPasswordFromAPI && this.videoPassword !== videoPasswordFromAPI) {
        logger.info('Using video password from API')

        this.videoPassword = videoPasswordFromAPI

        return true
      }

      logger.error('Password from embed API is not valid')

      return false
    }

    this.videoPassword = await this.playerHTML.askVideoPassword({
      incorrectPassword,
      translations: await this.translationsPromise
    })

    return true
  }

  private async buildPlayerIfNeeded () {
    if (this.peertubePlayer) {
      this.peertubePlayer.enable()

      return
    }

    const playerElement = document.createElement('video')
    playerElement.className = 'video-js vjs-peertube-skin'
    playerElement.setAttribute('playsinline', 'true')

    this.playerHTML.setInitVideoEl(playerElement)
    this.playerHTML.addInitVideoElToDOM()

    const [ { PeerTubePlayer } ] = await Promise.all([
      this.PeerTubePlayerManagerModulePromise,
      this.peertubePlugin.loadPlugins(this.config, await this.translationsPromise)
    ])

    const constructorOptions = this.playerOptionsBuilder.getPlayerConstructorOptions({
      serverConfig: this.config,
      authorizationHeader: () => this.http.getHeaderTokenValue()
    })
    this.peertubePlayer = new PeerTubePlayer(constructorOptions)

    this.player = this.peertubePlayer.getPlayer()
  }

  getImageDataUrl (): string {
    const canvas = document.createElement('canvas')

    canvas.width = this.player.videoWidth()
    canvas.height = this.player.videoHeight()

    const videoEl = this.player.tech(true).el() as HTMLVideoElement

    canvas.getContext('2d').drawImage(videoEl, 0, 0, canvas.width, canvas.height)

    return canvas.toDataURL('image/jpeg')
  }
}

PeerTubeEmbed.main()
  .catch(err => {
    (window as any).displayIncompatibleBrowser()

    logger.error('Cannot init embed.', err)
  })
