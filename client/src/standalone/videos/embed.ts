import './embed.scss'
import '../../assets/player/shared/dock/peertube-dock-component'
import '../../assets/player/shared/dock/peertube-dock-plugin'
import { PeerTubeServerError } from 'src/types'
import videojs from 'video.js'
import { peertubeTranslate } from '../../../../shared/core-utils/i18n'
import {
  HTMLServerConfig,
  ResultList,
  ServerErrorCode,
  VideoDetails,
  VideoPlaylist,
  VideoPlaylistElement,
  VideoState
} from '../../../../shared/models'
import { PeertubePlayerManager } from '../../assets/player'
import { TranslationsManager } from '../../assets/player/translations-manager'
import { getParamString, logger, videoRequiresFileToken } from '../../root-helpers'
import { PeerTubeEmbedApi } from './embed-api'
import {
  AuthHTTP,
  LiveManager,
  PeerTubePlugin,
  PlayerManagerOptions,
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
  private PeertubePlayerManagerModulePromise: Promise<any>

  private readonly http: AuthHTTP
  private readonly videoFetcher: VideoFetcher
  private readonly playlistFetcher: PlaylistFetcher
  private readonly peertubePlugin: PeerTubePlugin
  private readonly playerHTML: PlayerHTML
  private readonly playerManagerOptions: PlayerManagerOptions
  private readonly liveManager: LiveManager

  private playlistTracker: PlaylistTracker
  private videoPassword: string
  private requiresPassword: boolean

  constructor (videoWrapperId: string) {
    logger.registerServerSending(window.location.origin)

    this.http = new AuthHTTP()

    this.videoFetcher = new VideoFetcher(this.http)
    this.playlistFetcher = new PlaylistFetcher(this.http)
    this.peertubePlugin = new PeerTubePlugin(this.http)
    this.playerHTML = new PlayerHTML(videoWrapperId)
    this.playerManagerOptions = new PlayerManagerOptions(this.playerHTML, this.videoFetcher, this.peertubePlugin)
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

  getPlayerElement () {
    return this.playerHTML.getPlayerElement()
  }

  getScope () {
    return this.playerManagerOptions.getScope()
  }

  // ---------------------------------------------------------------------------

  async init () {
    this.translationsPromise = TranslationsManager.getServerTranslations(window.location.origin, navigator.language)
    this.PeertubePlayerManagerModulePromise = import('../../assets/player/peertube-player-manager')

    // Issue when we parsed config from HTML, fallback to API
    if (!this.config) {
      this.config = await this.http.fetch('/api/v1/config', { optionalAuth: false })
        .then(res => res.json())
    }

    const videoId = this.isPlaylistEmbed()
      ? await this.initPlaylist()
      : this.getResourceId()

    if (!videoId) return

    return this.loadVideoAndBuildPlayer({ uuid: videoId, autoplayFromPreviousVideo: false, forceAutoplay: false })
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
    if (this.playerManagerOptions.hasAPIEnabled()) {
      if (this.api) {
        this.api.reInit()
        return
      }

      this.api = new PeerTubeEmbedApi(this)
      this.api.initialize()
    }
  }

  // ---------------------------------------------------------------------------

  async playNextPlaylistVideo () {
    const next = this.playlistTracker.getNextPlaylistElement()
    if (!next) {
      logger.info('Next element not found in playlist.')
      return
    }

    this.playlistTracker.setCurrentElement(next)

    return this.loadVideoAndBuildPlayer({ uuid: next.video.uuid, autoplayFromPreviousVideo: true, forceAutoplay: false })
  }

  async playPreviousPlaylistVideo () {
    const previous = this.playlistTracker.getPreviousPlaylistElement()
    if (!previous) {
      logger.info('Previous element not found in playlist.')
      return
    }

    this.playlistTracker.setCurrentElement(previous)

    await this.loadVideoAndBuildPlayer({ uuid: previous.video.uuid, autoplayFromPreviousVideo: true, forceAutoplay: false })
  }

  getCurrentPlaylistPosition () {
    return this.playlistTracker.getCurrentPosition()
  }

  // ---------------------------------------------------------------------------

  private async loadVideoAndBuildPlayer (options: {
    uuid: string
    autoplayFromPreviousVideo: boolean
    forceAutoplay: boolean
  }) {
    const { uuid, autoplayFromPreviousVideo, forceAutoplay } = options

    try {
      const {
        videoResponse,
        captionsPromise,
        storyboardsPromise
      } = await this.videoFetcher.loadVideo({ videoId: uuid, videoPassword: this.videoPassword })

      return this.buildVideoPlayer({ videoResponse, captionsPromise, storyboardsPromise, autoplayFromPreviousVideo, forceAutoplay })
    } catch (err) {

      if (await this.handlePasswordError(err)) this.loadVideoAndBuildPlayer({ ...options })
      else this.playerHTML.displayError(err.message, await this.translationsPromise)
    }
  }

  private async buildVideoPlayer (options: {
    videoResponse: Response
    storyboardsPromise: Promise<Response>
    captionsPromise: Promise<Response>
    autoplayFromPreviousVideo: boolean
    forceAutoplay: boolean
  }) {
    const { videoResponse, captionsPromise, storyboardsPromise, autoplayFromPreviousVideo, forceAutoplay } = options

    this.resetPlayerElement()

    const videoInfoPromise = videoResponse.json()
      .then(async (videoInfo: VideoDetails) => {
        this.playerManagerOptions.loadParams(this.config, videoInfo)

        if (!autoplayFromPreviousVideo && !this.playerManagerOptions.hasAutoplay()) {
          this.playerHTML.buildPlaceholder(videoInfo)
        }
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
      storyboardsResponse,
      PeertubePlayerManagerModule
    ] = await Promise.all([
      videoInfoPromise,
      this.translationsPromise,
      captionsPromise,
      storyboardsPromise,
      this.PeertubePlayerManagerModulePromise
    ])

    await this.peertubePlugin.loadPlugins(this.config, translations)

    const PlayerManager: typeof PeertubePlayerManager = PeertubePlayerManagerModule.PeertubePlayerManager

    const playerOptions = await this.playerManagerOptions.getPlayerOptions({
      video,
      captionsResponse,
      autoplayFromPreviousVideo,
      translations,
      serverConfig: this.config,

      storyboardsResponse,

      authorizationHeader: () => this.http.getHeaderTokenValue(),
      videoFileToken: () => videoFileToken,
      videoPassword: () => this.videoPassword,
      requiresPassword: this.requiresPassword,

      onVideoUpdate: (uuid: string) => this.loadVideoAndBuildPlayer({ uuid, autoplayFromPreviousVideo: true, forceAutoplay: false }),

      playlistTracker: this.playlistTracker,
      playNextPlaylistVideo: () => this.playNextPlaylistVideo(),
      playPreviousPlaylistVideo: () => this.playPreviousPlaylistVideo(),

      live,
      forceAutoplay
    })

    this.player = await PlayerManager.initialize(this.playerManagerOptions.getMode(), playerOptions, (player: videojs.Player) => {
      this.player = player
    })

    this.player.on('customError', (event: any, data: any) => {
      const message = data?.err?.message || ''
      if (!message.includes('from xs param')) return

      this.player.dispose()
      this.playerHTML.removePlayerElement()
      this.playerHTML.displayError('This video is not available because the remote instance is not responding.', translations)
    });

    (window as any)['videojsPlayer'] = this.player

    this.buildCSS()
    this.buildPlayerDock(video)
    this.initializeApi()

    this.playerHTML.removePlaceholder()
    if (this.videoPassword) this.playerHTML.removeVideoPasswordBlock()

    if (this.isPlaylistEmbed()) {
      await this.buildPlayerPlaylistUpnext()

      this.player.playlist().updateSelected()

      this.player.on('stopped', () => {
        this.playNextPlaylistVideo()
      })
    }

    if (video.isLive) {
      this.liveManager.listenForChanges({
        video,
        onPublishedVideo: () => {
          this.liveManager.stopListeningForChanges(video)
          this.loadVideoAndBuildPlayer({ uuid: video.uuid, autoplayFromPreviousVideo: false, forceAutoplay: true })
        }
      })

      if (video.state.id === VideoState.WAITING_FOR_LIVE || video.state.id === VideoState.LIVE_ENDED) {
        this.liveManager.displayInfo({ state: video.state.id, translations })

        this.disablePlayer()
      } else {
        this.correctlyHandleLiveEnding(translations)
      }
    }

    this.peertubePlugin.getPluginsManager().runHook('action:embed.player.loaded', undefined, { player: this.player, videojs, video })
  }

  private resetPlayerElement () {
    if (this.player) {
      this.player.dispose()
      this.player = undefined
    }

    const playerElement = document.createElement('video')
    playerElement.className = 'video-js vjs-peertube-skin'
    playerElement.setAttribute('playsinline', 'true')

    this.playerHTML.setPlayerElement(playerElement)
    this.playerHTML.addPlayerElementToDOM()
  }

  private async buildPlayerPlaylistUpnext () {
    const translations = await this.translationsPromise

    this.player.upnext({
      timeout: 10000, // 10s
      headText: peertubeTranslate('Up Next', translations),
      cancelText: peertubeTranslate('Cancel', translations),
      suspendedText: peertubeTranslate('Autoplay is suspended', translations),
      getTitle: () => this.playlistTracker.nextVideoTitle(),
      next: () => this.playNextPlaylistVideo(),
      condition: () => !!this.playlistTracker.getNextPlaylistElement(),
      suspended: () => false
    })
  }

  private buildPlayerDock (videoInfo: VideoDetails) {
    if (!this.playerManagerOptions.hasControls()) return

    // On webtorrent fallback, player may have been disposed
    if (!this.player.player_) return

    const title = this.playerManagerOptions.hasTitle()
      ? videoInfo.name
      : undefined

    const description = this.playerManagerOptions.hasWarningTitle() && this.playerManagerOptions.hasP2PEnabled()
      ? '<span class="text">' + peertubeTranslate('Watching this video may reveal your IP address to others.') + '</span>'
      : undefined

    if (!title && !description) return

    const availableAvatars = videoInfo.channel.avatars.filter(a => a.width < 50)
    const avatar = availableAvatars.length !== 0
      ? availableAvatars[0]
      : undefined

    this.player.peertubeDock({
      title,
      description,
      avatarUrl: title && avatar
        ? avatar.path
        : undefined
    })
  }

  private buildCSS () {
    const body = document.getElementById('custom-css')

    if (this.playerManagerOptions.hasBigPlayBackgroundColor()) {
      body.style.setProperty('--embedBigPlayBackgroundColor', this.playerManagerOptions.getBigPlayBackgroundColor())
    }

    if (this.playerManagerOptions.hasForegroundColor()) {
      body.style.setProperty('--embedForegroundColor', this.playerManagerOptions.getForegroundColor())
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

      this.disablePlayer()
    })
  }

  private disablePlayer () {
    if (this.player.isFullscreen()) {
      this.player.exitFullscreen()
    }

    // Disable player
    this.player.hasStarted(false)
    this.player.removeClass('vjs-has-autoplay')
    this.player.bigPlayButton.hide();

    (this.player.el() as HTMLElement).style.pointerEvents = 'none'
  }

  private async handlePasswordError (err: PeerTubeServerError) {
    let incorrectPassword: boolean = null
    if (err.serverCode === ServerErrorCode.VIDEO_REQUIRES_PASSWORD) incorrectPassword = false
    else if (err.serverCode === ServerErrorCode.INCORRECT_VIDEO_PASSWORD) incorrectPassword = true

    if (incorrectPassword === null) return false

    this.requiresPassword = true
    this.videoPassword = await this.playerHTML.askVideoPassword({
      incorrectPassword,
      translations: await this.translationsPromise
    })
    return true
  }

}

PeerTubeEmbed.main()
  .catch(err => {
    (window as any).displayIncompatibleBrowser()

    logger.error('Cannot init embed.', err)
  })
