import { peertubeTranslate } from '../../../../../shared/core-utils/i18n'
import {
  HTMLServerConfig,
  LiveVideo,
  Storyboard,
  Video,
  VideoCaption,
  VideoDetails,
  VideoPlaylistElement,
  VideoState,
  VideoStreamingPlaylistType
} from '../../../../../shared/models'
import { P2PMediaLoaderOptions, PeertubePlayerManagerOptions, PlayerMode, VideoJSCaption } from '../../../assets/player'
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
import { PeerTubePlugin } from './peertube-plugin'
import { PlayerHTML } from './player-html'
import { PlaylistTracker } from './playlist-tracker'
import { Translations } from './translations'
import { VideoFetcher } from './video-fetcher'

export class PlayerManagerOptions {
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

  // ---------------------------------------------------------------------------

  loadParams (config: HTMLServerConfig, video: VideoDetails) {
    try {
      const params = new URL(window.location.toString()).searchParams

      this.autoplay = getParamToggle(params, 'autoplay', false)
      // Disable auto play on live videos that are not streamed
      if (video.state.id === VideoState.LIVE_ENDED || video.state.id === VideoState.WAITING_FOR_LIVE) {
        this.autoplay = false
      }

      this.controls = getParamToggle(params, 'controls', true)
      this.controlBar = getParamToggle(params, 'controlBar', true)

      this.muted = getParamToggle(params, 'muted', undefined)
      this.loop = getParamToggle(params, 'loop', false)
      this.title = getParamToggle(params, 'title', true)
      this.enableApi = getParamToggle(params, 'api', this.enableApi)
      this.warningTitle = getParamToggle(params, 'warningTitle', true)
      this.peertubeLink = getParamToggle(params, 'peertubeLink', true)
      this.p2pEnabled = getParamToggle(params, 'p2p', this.isP2PEnabled(config, video))

      this.scope = getParamString(params, 'scope', this.scope)
      this.subtitle = getParamString(params, 'subtitle')
      this.startTime = getParamString(params, 'start')
      this.stopTime = getParamString(params, 'stop')
      this.playbackRate = getParamString(params, 'playbackRate')

      this.bigPlayBackgroundColor = getParamString(params, 'bigPlayBackgroundColor')
      this.foregroundColor = getParamString(params, 'foregroundColor')

      const modeParam = getParamString(params, 'mode')

      if (modeParam) {
        if (modeParam === 'p2p-media-loader') this.mode = 'p2p-media-loader'
        else this.mode = 'webtorrent'
      } else {
        if (Array.isArray(video.streamingPlaylists) && video.streamingPlaylists.length !== 0) this.mode = 'p2p-media-loader'
        else this.mode = 'webtorrent'
      }
    } catch (err) {
      logger.error('Cannot get params from URL.', err)
    }
  }

  // ---------------------------------------------------------------------------

  async getPlayerOptions (options: {
    video: VideoDetails
    captionsResponse: Response

    storyboardsResponse: Response

    live?: LiveVideo

    forceAutoplay: boolean

    authorizationHeader: () => string
    videoFileToken: () => string

    videoPassword: () => string
    requiresPassword: boolean

    serverConfig: HTMLServerConfig

    autoplayFromPreviousVideo: boolean

    translations: Translations

    playlistTracker?: PlaylistTracker
    playNextPlaylistVideo?: () => any
    playPreviousPlaylistVideo?: () => any
    onVideoUpdate?: (uuid: string) => any
  }) {
    const {
      video,
      captionsResponse,
      autoplayFromPreviousVideo,
      videoFileToken,
      videoPassword,
      requiresPassword,
      translations,
      forceAutoplay,
      playlistTracker,
      live,
      storyboardsResponse,
      authorizationHeader,
      serverConfig
    } = options

    const [ videoCaptions, storyboard ] = await Promise.all([
      this.buildCaptions(captionsResponse, translations),
      this.buildStoryboard(storyboardsResponse)
    ])

    const playerOptions: PeertubePlayerManagerOptions = {
      common: {
        // Autoplay in playlist mode
        autoplay: autoplayFromPreviousVideo ? true : this.autoplay,
        forceAutoplay,

        controls: this.controls,
        controlBar: this.controlBar,

        muted: this.muted,
        loop: this.loop,

        p2pEnabled: this.p2pEnabled,

        captions: videoCaptions.length !== 0,
        subtitle: this.subtitle,

        storyboard,

        startTime: playlistTracker
          ? playlistTracker.getCurrentElement().startTimestamp
          : this.startTime,
        stopTime: playlistTracker
          ? playlistTracker.getCurrentElement().stopTimestamp
          : this.stopTime,

        playbackRate: this.playbackRate,

        videoCaptions,
        inactivityTimeout: 2500,
        videoViewUrl: this.videoFetcher.getVideoViewsUrl(video.uuid),
        videoViewIntervalMs: 5000,
        metricsUrl: window.location.origin + '/api/v1/metrics/playback',

        videoShortUUID: video.shortUUID,
        videoUUID: video.uuid,

        playerElement: this.playerHTML.getPlayerElement(),
        onPlayerElementChange: (element: HTMLVideoElement) => {
          this.playerHTML.setPlayerElement(element)
        },

        videoDuration: video.duration,
        enableHotkeys: true,

        peertubeLink: this.peertubeLink,
        instanceName: serverConfig.instance.name,

        poster: window.location.origin + video.previewPath,
        theaterButton: false,

        serverUrl: window.location.origin,
        language: navigator.language,
        embedUrl: window.location.origin + video.embedPath,
        embedTitle: video.name,

        requiresUserAuth: videoRequiresUserAuth(video),
        authorizationHeader,
        videoFileToken,

        requiresPassword,
        videoPassword,

        errorNotifier: () => {
          // Empty, we don't have a notifier in the embed
        },

        ...this.buildLiveOptions(video, live),

        ...this.buildPlaylistOptions(options)
      },

      webtorrent: {
        videoFiles: video.files
      },

      ...this.buildP2PMediaLoaderOptions(video),

      pluginsManager: this.peertubePlugin.getPluginsManager()
    }

    return playerOptions
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
      url: window.location.origin + storyboards[0].storyboardPath,
      height: storyboards[0].spriteHeight,
      width: storyboards[0].spriteWidth,
      interval: storyboards[0].spriteDuration
    }
  }

  private buildPlaylistOptions (options: {
    playlistTracker?: PlaylistTracker
    playNextPlaylistVideo?: () => any
    playPreviousPlaylistVideo?: () => any
    onVideoUpdate?: (uuid: string) => any
  }) {
    const { playlistTracker, playNextPlaylistVideo, playPreviousPlaylistVideo, onVideoUpdate } = options

    if (!playlistTracker) return {}

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

      nextVideo: () => playNextPlaylistVideo(),
      hasNextVideo: () => playlistTracker.hasNextPlaylistElement(),

      previousVideo: () => playPreviousPlaylistVideo(),
      hasPreviousVideo: () => playlistTracker.hasPreviousPlaylistElement()
    }
  }

  private buildP2PMediaLoaderOptions (video: VideoDetails) {
    if (this.mode !== 'p2p-media-loader') return {}

    const hlsPlaylist = video.streamingPlaylists.find(p => p.type === VideoStreamingPlaylistType.HLS)

    return {
      p2pMediaLoader: {
        playlistUrl: hlsPlaylist.playlistUrl,
        segmentsSha256Url: hlsPlaylist.segmentsSha256Url,
        redundancyBaseUrls: hlsPlaylist.redundancies.map(r => r.baseUrl),
        trackerAnnounce: video.trackerUrls,
        videoFiles: hlsPlaylist.files
      } as P2PMediaLoaderOptions
    }
  }

  // ---------------------------------------------------------------------------

  private async buildCaptions (captionsResponse: Response, translations: Translations): Promise<VideoJSCaption[]> {
    if (captionsResponse.ok) {
      const { data } = await captionsResponse.json()

      return data.map((c: VideoCaption) => ({
        label: peertubeTranslate(c.language.label, translations),
        language: c.language.id,
        src: window.location.origin + c.captionPath
      }))
    }

    return []
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
