import { peertubeTranslate } from '@peertube/peertube-core-utils'
import {
  HTMLServerConfig,
  LiveVideo,
  Storyboard,
  Video,
  VideoCaption,
  VideoChapter,
  VideoDetails,
  VideoPlaylistElement,
  VideoState,
  VideoStreamingPlaylistType
} from '@peertube/peertube-models'
import {
  getBoolOrDefault,
  getParamString,
  getParamToggle,
  isP2PEnabled,
  logger,
  peertubeLocalStorage,
  UserLocalStorageKeys,
  videoRequiresUserAuth
} from '../../../root-helpers'
import { HLSOptions, PeerTubePlayerConstructorOptions, PeerTubePlayerLoadOptions, PlayerMode, VideoJSCaption } from '../../player'
import { PeerTubePlugin } from './peertube-plugin'
import { PlayerHTML } from './player-html'
import { PlaylistTracker } from './playlist-tracker'
import { Translations } from './translations'
import { getBackendUrl } from './url'
import { VideoFetcher } from './video-fetcher'

export class PlayerOptionsBuilder {
  private autoplay: boolean

  private controls: boolean
  private controlBar: boolean

  private muted: boolean
  private loop: boolean
  private subtitle: string
  private enableApi = false
  private startTime: number | string = 0
  private stopTime: number | string
  private playbackRate: number | string

  private title: boolean
  private warningTitle: boolean
  private peertubeLink: boolean
  private p2pEnabled: boolean
  private bigPlayBackgroundColor: string
  private foregroundColor: string

  private waitPasswordFromEmbedAPI = false

  private mode: PlayerMode
  private scope = 'peertube'

  constructor (
    private readonly playerHTML: PlayerHTML,
    private readonly videoFetcher: VideoFetcher,
    private readonly peertubePlugin: PeerTubePlugin
  ) {}

  hasAPIEnabled () {
    return this.enableApi
  }

  hasAutoplay () {
    return this.autoplay
  }

  hasControls () {
    return this.controls
  }

  hasTitle () {
    return this.title
  }

  hasWarningTitle () {
    return this.warningTitle
  }

  hasP2PEnabled () {
    return !!this.p2pEnabled
  }

  hasBigPlayBackgroundColor () {
    return !!this.bigPlayBackgroundColor
  }

  getBigPlayBackgroundColor () {
    return this.bigPlayBackgroundColor
  }

  hasForegroundColor () {
    return !!this.foregroundColor
  }

  getForegroundColor () {
    return this.foregroundColor
  }

  getMode () {
    return this.mode
  }

  getScope () {
    return this.scope
  }

  mustWaitPasswordFromEmbedAPI () {
    return this.waitPasswordFromEmbedAPI
  }

  // ---------------------------------------------------------------------------

  loadCommonParams () {
    try {
      const params = new URL(window.location.toString()).searchParams

      this.controls = getParamToggle(params, 'controls', true)
      this.controlBar = getParamToggle(params, 'controlBar', true)

      this.muted = getParamToggle(params, 'muted', undefined)
      this.loop = getParamToggle(params, 'loop', false)
      this.title = getParamToggle(params, 'title', true)
      this.enableApi = getParamToggle(params, 'api', this.enableApi)
      this.waitPasswordFromEmbedAPI = getParamToggle(params, 'waitPasswordFromEmbedAPI', this.waitPasswordFromEmbedAPI)
      this.warningTitle = getParamToggle(params, 'warningTitle', true)
      this.peertubeLink = getParamToggle(params, 'peertubeLink', true)

      this.scope = getParamString(params, 'scope', this.scope)
      this.subtitle = getParamString(params, 'subtitle')
      this.startTime = getParamString(params, 'start')
      this.stopTime = getParamString(params, 'stop')
      this.playbackRate = getParamString(params, 'playbackRate')

      this.bigPlayBackgroundColor = getParamString(params, 'bigPlayBackgroundColor')
      this.foregroundColor = getParamString(params, 'foregroundColor')
    } catch (err) {
      logger.error('Cannot get params from URL.', err)
    }
  }

  loadVideoParams (config: HTMLServerConfig, video: VideoDetails) {
    try {
      const params = new URL(window.location.toString()).searchParams

      this.autoplay = getParamToggle(params, 'autoplay', false)
      // Disable auto play on live videos that are not streamed
      if (video.state.id === VideoState.LIVE_ENDED || video.state.id === VideoState.WAITING_FOR_LIVE) {
        this.autoplay = false
      }

      this.p2pEnabled = getParamToggle(params, 'p2p', this.isP2PEnabled(config, video))

      const modeParam = getParamString(params, 'mode')

      if (modeParam) {
        if (modeParam === 'p2p-media-loader') this.mode = 'p2p-media-loader'
        else this.mode = 'web-video'
      } else {
        if (Array.isArray(video.streamingPlaylists) && video.streamingPlaylists.length !== 0) this.mode = 'p2p-media-loader'
        else this.mode = 'web-video'
      }
    } catch (err) {
      logger.error('Cannot get params from URL.', err)
    }
  }

  // ---------------------------------------------------------------------------

  getPlayerConstructorOptions (options: {
    serverConfig: HTMLServerConfig
    authorizationHeader: () => string
  }): PeerTubePlayerConstructorOptions {
    const { serverConfig, authorizationHeader } = options

    return {
      controls: this.controls,
      controlBar: this.controlBar,

      muted: this.muted,
      loop: this.loop,

      playbackRate: this.playbackRate,

      inactivityTimeout: 2500,

      videoViewIntervalMs: serverConfig.views.videos.watchingInterval.anonymous,

      metricsUrl: serverConfig.openTelemetry.metrics.enabled
        ? getBackendUrl() + '/api/v1/metrics/playback'
        : null,
      metricsInterval: serverConfig.openTelemetry.metrics.playbackStatsInterval,

      authorizationHeader,

      playerElement: () => this.playerHTML.getInitVideoEl(),
      enableHotkeys: true,

      peertubeLink: () => this.peertubeLink,
      instanceName: serverConfig.instance.name,

      theaterButton: false,

      serverUrl: getBackendUrl(),
      stunServers: serverConfig.webrtc.stunServers,
      language: navigator.language,

      pluginsManager: this.peertubePlugin.getPluginsManager(),

      errorNotifier: () => {
        // Empty, we don't have a notifier in the embed
      }
    }
  }

  async getPlayerLoadOptions (options: {
    video: VideoDetails
    captionsResponse: Response

    storyboardsResponse: Response

    chaptersResponse: Response

    live?: LiveVideo

    alreadyPlayed: boolean
    forceAutoplay: boolean

    videoFileToken: () => string

    videoPassword: () => string
    requiresPassword: boolean

    translations: Translations

    playlist?: {
      playlistTracker: PlaylistTracker
      playNext: () => any
      playPrevious: () => any
      onVideoUpdate: (uuid: string) => any
    }
  }): Promise<PeerTubePlayerLoadOptions> {
    const {
      video,
      captionsResponse,
      videoFileToken,
      videoPassword,
      requiresPassword,
      translations,
      alreadyPlayed,
      forceAutoplay,
      playlist,
      live,
      storyboardsResponse,
      chaptersResponse
    } = options

    const [ videoCaptions, storyboard, chapters ] = await Promise.all([
      this.buildCaptions(captionsResponse, translations),
      this.buildStoryboard(storyboardsResponse),
      this.buildChapters(chaptersResponse)
    ])

    return {
      mode: this.mode,

      autoplay: forceAutoplay || alreadyPlayed || this.autoplay,
      forceAutoplay,

      p2pEnabled: this.p2pEnabled,

      subtitle: this.subtitle,

      storyboard,
      videoChapters: chapters,

      startTime: playlist
        ? playlist.playlistTracker.getCurrentElement().startTimestamp
        : this.startTime,
      stopTime: playlist
        ? playlist.playlistTracker.getCurrentElement().stopTimestamp
        : this.stopTime,

      videoCaptions,
      videoViewUrl: this.videoFetcher.getVideoViewsUrl(video.uuid),

      videoShortUUID: video.shortUUID,
      videoUUID: video.uuid,

      duration: video.duration,
      videoRatio: video.aspectRatio,

      poster: getBackendUrl() + video.previewPath,

      embedUrl: getBackendUrl() + video.embedPath,
      embedTitle: video.name,

      requiresUserAuth: videoRequiresUserAuth(video),
      videoFileToken,

      requiresPassword,
      videoPassword,

      ...this.buildLiveOptions(video, live),

      ...this.buildPlaylistOptions(playlist),

      dock: this.buildDockOptions(video),

      webVideo: {
        videoFiles: video.files
      },

      hls: this.buildHLSOptions(video)
    }
  }

  private buildLiveOptions (video: VideoDetails, live: LiveVideo) {
    if (!video.isLive) return { isLive: false }

    return {
      isLive: true,
      liveOptions: {
        latencyMode: live.latencyMode
      }
    }
  }

  private async buildStoryboard (storyboardsResponse: Response) {
    const { storyboards } = await storyboardsResponse.json() as { storyboards: Storyboard[] }
    if (!storyboards || storyboards.length === 0) return undefined

    return {
      url: storyboards[0].fileUrl,
      height: storyboards[0].spriteHeight,
      width: storyboards[0].spriteWidth,
      interval: storyboards[0].spriteDuration
    }
  }

  private async buildChapters (chaptersResponse: Response) {
    const { chapters } = await chaptersResponse.json() as { chapters: VideoChapter[] }

    return chapters
  }

  private buildPlaylistOptions (options?: {
    playlistTracker: PlaylistTracker
    playNext: () => any
    playPrevious: () => any
    onVideoUpdate: (uuid: string) => any
  }) {
    if (!options) {
      return {
        nextVideo: {
          enabled: false,
          displayControlBarButton: false,
          getVideoTitle: () => ''
        },
        previousVideo: {
          enabled: false,
          displayControlBarButton: false
        }
      }
    }

    const { playlistTracker, playNext, playPrevious, onVideoUpdate } = options

    return {
      playlist: {
        elements: playlistTracker.getPlaylistElements(),
        playlist: playlistTracker.getPlaylist(),

        getCurrentPosition: () => playlistTracker.getCurrentPosition(),

        onItemClicked: (videoPlaylistElement: VideoPlaylistElement) => {
          playlistTracker.setCurrentElement(videoPlaylistElement)

          onVideoUpdate(videoPlaylistElement.video.uuid)
        }
      },

      previousVideo: {
        enabled: playlistTracker.hasPreviousPlaylistElement(),
        handler: () => playPrevious(),
        displayControlBarButton: true
      },

      nextVideo: {
        enabled: playlistTracker.hasNextPlaylistElement(),
        handler: () => playNext(),
        getVideoTitle: () => playlistTracker.getNextPlaylistElement()?.video?.name,
        displayControlBarButton: true
      },

      upnext: {
        isEnabled: () => true,
        isSuspended: () => false,
        timeout: 0
      }
    }
  }

  private buildHLSOptions (video: VideoDetails): HLSOptions {
    const hlsPlaylist = video.streamingPlaylists.find(p => p.type === VideoStreamingPlaylistType.HLS)
    if (!hlsPlaylist) return undefined

    return {
      playlistUrl: hlsPlaylist.playlistUrl,
      segmentsSha256Url: hlsPlaylist.segmentsSha256Url,
      redundancyBaseUrls: hlsPlaylist.redundancies.map(r => r.baseUrl),
      trackerAnnounce: video.trackerUrls,
      videoFiles: hlsPlaylist.files
    }
  }

  // ---------------------------------------------------------------------------

  private async buildCaptions (captionsResponse: Response, translations: Translations): Promise<VideoJSCaption[]> {
    if (captionsResponse.ok) {
      const { data } = await captionsResponse.json()

      return data.map((c: VideoCaption) => ({
        label: peertubeTranslate(c.language.label, translations),
        language: c.language.id,
        automaticallyGenerated: c.automaticallyGenerated,
        src: c.fileUrl
      }))
    }

    return []
  }

  // ---------------------------------------------------------------------------

  private buildDockOptions (videoInfo: VideoDetails) {
    if (!this.hasControls()) return undefined

    const title = this.hasTitle()
      ? videoInfo.name
      : undefined

    const description = this.hasWarningTitle() && this.hasP2PEnabled()
      ? peertubeTranslate('Watching this video may reveal your IP address to others.')
      : undefined

    if (!title && !description) return

    const availableAvatars = videoInfo.channel.avatars.filter(a => a.width < 50)
    const avatar = availableAvatars.length !== 0
      ? availableAvatars[0]
      : undefined

    return {
      title,
      description,
      avatarUrl: title && avatar
        ? avatar.path
        : undefined
    }
  }

  // ---------------------------------------------------------------------------

  private isP2PEnabled (config: HTMLServerConfig, video: Video) {
    const userP2PEnabled = getBoolOrDefault(
      peertubeLocalStorage.getItem(UserLocalStorageKeys.P2P_ENABLED),
      config.defaults.p2p.embed.enabled
    )

    return isP2PEnabled(video, config, userP2PEnabled)
  }
}
