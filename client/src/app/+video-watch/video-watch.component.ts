import { CommonModule, PlatformLocation } from '@angular/common'
import { Component, ElementRef, inject, LOCALE_ID, NgZone, OnDestroy, OnInit, viewChild } from '@angular/core'
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router'
import {
  AuthService,
  AuthUser,
  ConfirmService,
  Hotkey,
  HotkeysService,
  MetaService,
  Notifier,
  PeerTubeSocket,
  PluginService,
  RestExtractor,
  ScreenService,
  ServerService,
  User,
  UserService
} from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { getAPIUrl, getOriginUrl, isXPercentInViewport, scrollToTop, toBoolean } from '@app/helpers'
import { VideoCaptionService } from '@app/shared/shared-main/video-caption/video-caption.service'
import { VideoChapterService } from '@app/shared/shared-main/video/video-chapter.service'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { VideoFileTokenService } from '@app/shared/shared-main/video/video-file-token.service'
import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { SubscribeButtonComponent } from '@app/shared/shared-user-subscription/subscribe-button.component'
import { LiveVideoService } from '@app/shared/shared-video-live/live-video.service'
import { VideoPlaylist } from '@app/shared/shared-video-playlist/video-playlist.model'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { PlayerSettingsService } from '@app/shared/shared-video/player-settings.service'
import { getVideoRSSFeeds, timeToInt } from '@peertube/peertube-core-utils'
import {
  HTMLServerConfig,
  HttpStatusCode,
  LiveVideo,
  PeerTubeProblemDocument,
  PlayerMode,
  PlayerTheme,
  PlayerVideoSettings,
  ServerErrorCode,
  Storyboard,
  VideoCaption,
  VideoChapter,
  VideoPrivacy,
  VideoState,
  VideoStateType
} from '@peertube/peertube-models'
import {
  cleanupVideoWatch,
  getStoredTheater,
  getStoredVideoWatchHistory,
  HLSOptions,
  PeerTubePlayer,
  PeerTubePlayerConstructorOptions,
  PeerTubePlayerLoadOptions,
  videojs,
  VideojsPlayer
} from '@peertube/player'
import { logger } from '@root-helpers/logger'
import { isP2PEnabled, videoRequiresFileToken, videoRequiresUserAuth } from '@root-helpers/video'
import debug from 'debug'
import { forkJoin, map, Observable, of, Subscription, switchMap } from 'rxjs'
import { environment } from '../../environments/environment'
import { AccountOnChannelAvatarComponent } from '../shared/shared-actor-image/account-on-channel-avatar.component'
import { DateToggleComponent } from '../shared/shared-main/date/date-toggle.component'
import { PluginPlaceholderComponent } from '../shared/shared-main/plugins/plugin-placeholder.component'
import { VideoViewsCounterComponent } from '../shared/shared-video/video-views-counter.component'
import { PlayerStylesComponent } from './player-styles.component'
import { ActionButtonsComponent } from './shared/action-buttons/action-buttons.component'
import { VideoCommentsComponent } from './shared/comment/video-comments.component'
import { PrivacyConcernsComponent } from './shared/information/privacy-concerns.component'
import { VideoAlertComponent } from './shared/information/video-alert.component'
import { VideoAttributesComponent } from './shared/metadata/video-attributes.component'
import { VideoDescriptionComponent } from './shared/metadata/video-description.component'
import { VideoTranscriptionComponent } from './shared/player-widgets/video-transcription.component'
import { VideoWatchPlaylistComponent } from './shared/player-widgets/video-watch-playlist.component'
import { RecommendedVideosComponent } from './shared/recommendations/recommended-videos.component'
import { VideoPremiereComponent } from './shared/premiere/video-premiere.component'

const debugLogger = debug('peertube:watch:VideoWatchComponent')

type URLOptions = {
  playerMode: PlayerMode
  playerTheme?: PlayerTheme

  startTime: number | string
  stopTime: number | string

  controls?: boolean
  controlBar?: boolean

  muted?: boolean
  loop?: boolean
  subtitle?: string
  resume?: string

  peertubeLink: boolean

  playbackRate?: number | string
}

@Component({
  selector: 'my-video-watch',
  templateUrl: './video-watch.component.html',
  styleUrls: [ './video-watch.component.scss' ],
  imports: [
    CommonModule,
    VideoWatchPlaylistComponent,
    PluginPlaceholderComponent,
    VideoAlertComponent,
    DateToggleComponent,
    VideoViewsCounterComponent,
    ActionButtonsComponent,
    AccountOnChannelAvatarComponent,
    RouterLink,
    SubscribeButtonComponent,
    VideoDescriptionComponent,
    VideoAttributesComponent,
    VideoCommentsComponent,
    RecommendedVideosComponent,
    PrivacyConcernsComponent,
    PlayerStylesComponent,
    VideoWatchPlaylistComponent,
    VideoTranscriptionComponent,
    VideoPremiereComponent
  ]
})
export class VideoWatchComponent implements OnInit, OnDestroy {
  VideoPrivacy = VideoPrivacy // Make VideoPrivacy accessible in template
  
  private route = inject(ActivatedRoute)
  private router = inject(Router)
  private videoService = inject(VideoService)
  private playlistService = inject(VideoPlaylistService)
  private liveVideoService = inject(LiveVideoService)
  private confirmService = inject(ConfirmService)
  private authService = inject(AuthService)
  private userService = inject(UserService)
  private serverService = inject(ServerService)
  private restExtractor = inject(RestExtractor)
  private notifier = inject(Notifier)
  private zone = inject(NgZone)
  private videoCaptionService = inject(VideoCaptionService)
  private videoChapterService = inject(VideoChapterService)
  private playerSettingsService = inject(PlayerSettingsService)
  private hotkeysService = inject(HotkeysService)
  private hooks = inject(HooksService)
  private pluginService = inject(PluginService)
  private peertubeSocket = inject(PeerTubeSocket)
  private screenService = inject(ScreenService)
  private videoFileTokenService = inject(VideoFileTokenService)
  private location = inject(PlatformLocation)
  private metaService = inject(MetaService)
  private localeId = inject(LOCALE_ID)

  readonly videoWatchPlaylist = viewChild<VideoWatchPlaylistComponent>('videoWatchPlaylist')
  readonly subscribeButton = viewChild<SubscribeButtonComponent>('subscribeButton')
  readonly playerElement = viewChild<ElementRef<HTMLVideoElement>>('playerElement')

  peertubePlayer: PeerTubePlayer
  theaterEnabled = false

  video: VideoDetails = null
  videoCaptions: VideoCaption[] = []
  videoChapters: VideoChapter[] = []
  liveVideo: LiveVideo
  videoPassword: string
  storyboards: Storyboard[] = []
  playerSettings: PlayerVideoSettings

  playlistPosition: number
  playlist: VideoPlaylist = null

  remoteServerDown = false
  noPlaylistVideoFound = false

  transcriptionWidgetOpened = false

  private nextRecommendedVideoId = ''
  private nextRecommendedVideoTitle = ''

  private videoFileToken: string

  private currentTime: number

  private paramsSub: Subscription
  private queryParamsSub: Subscription
  private configSub: Subscription
  private liveVideosSub: Subscription

  private serverConfig: HTMLServerConfig

  private hotkeys: Hotkey[] = []

  get authUser () {
    return this.authService.getUser()
  }

  get anonymousUser () {
    return this.userService.getAnonymousUser()
  }

  async ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.loadRouteParams()
    this.loadRouteQuery()

    this.theaterEnabled = getStoredTheater()

    this.hooks.runAction('action:video-watch.init', 'video-watch')

    setTimeout(cleanupVideoWatch, 1500) // Run in timeout to ensure we're not blocking the UI

    const constructorOptions = await this.hooks.wrapFun(
      this.buildPeerTubePlayerConstructorOptions.bind(this),
      { urlOptions: this.getUrlOptions() },
      'video-watch',
      'filter:internal.video-watch.player.build-options.params',
      'filter:internal.video-watch.player.build-options.result'
    )

    this.peertubePlayer = new PeerTubePlayer(constructorOptions)
  }

  ngOnDestroy () {
    if (this.peertubePlayer) this.peertubePlayer.destroy()

    // Unsubscribe subscriptions
    if (this.paramsSub) this.paramsSub.unsubscribe()
    if (this.queryParamsSub) this.queryParamsSub.unsubscribe()
    if (this.configSub) this.configSub.unsubscribe()
    if (this.liveVideosSub) this.liveVideosSub.unsubscribe()

    // Unbind hotkeys
    this.hotkeysService.remove(this.hotkeys)

    this.metaService.revertMetaTags()
  }

  getCurrentTime () {
    return this.currentTime
  }

  getCurrentPlaylistPosition () {
    return this.videoWatchPlaylist().currentPlaylistPosition
  }

  onRecommendations (videos: Video[]) {
    if (videos.length === 0) return

    // The recommended videos's first element should be the next video
    const video = videos[0]
    this.nextRecommendedVideoId = video.shortUUID
    this.nextRecommendedVideoTitle = video.name
  }

  // ---------------------------------------------------------------------------

  handleTimestampClicked (timestamp: number) {
    if (!this.peertubePlayer || this.video.isLive) return

    const player = this.peertubePlayer.getPlayer()
    if (!player) return

    this.peertubePlayer.setCurrentTime(timestamp)

    scrollToTop()
  }

  // ---------------------------------------------------------------------------

  onPlaylistVideoFound (videoId: string) {
    this.loadVideo({ videoId, forceAutoplay: false })
  }

  onPlaylistNoVideoFound () {
    this.noPlaylistVideoFound = true
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  isUserOwner () {
    return this.video.isLocal === true && this.video.account.name === this.authUser?.username
  }

  isChannelDisplayNameGeneric () {
    const genericChannelDisplayName = [
      `Main ${this.video.channel.ownerAccount.name} channel`,
      `Default ${this.video.channel.ownerAccount.name} channel`
    ]

    return genericChannelDisplayName.includes(this.video.channel.displayName)
  }

  getAccountOrChannelRouterLink () {
    if (!this.isChannelDisplayNameGeneric()) {
      return `/c/${this.video.byVideoChannel}`
    }

    return `/a/${this.video.byAccount}`
  }

  displayOtherVideosAsRow () {
    // Use the same value as in the SASS file
    return this.screenService.getWindowInnerWidth() <= 1100
  }

  private loadRouteParams () {
    this.paramsSub = this.route.params.subscribe(routeParams => {
      const videoId = routeParams['videoId']
      if (videoId) return this.loadVideo({ videoId, forceAutoplay: false })

      const playlistId = routeParams['playlistId']
      if (playlistId) return this.loadPlaylist(playlistId)
    })
  }

  private loadRouteQuery () {
    this.queryParamsSub = this.route.queryParams.subscribe(queryParams => {
      if (!this.parsePlaylistPosition(queryParams)) return

      this.videoWatchPlaylist().updatePlaylistIndex(this.playlistPosition)

      const start = queryParams['start']
      if (this.peertubePlayer?.getPlayer() && start) {
        this.peertubePlayer.setCurrentTime(parseInt(start, 10))
      }
    })
  }

  private parsePlaylistPosition (queryParams: Params) {
    // Handle the ?playlistPosition
    const positionParam = queryParams['playlistPosition']
    if (!positionParam) return false

    this.playlistPosition = positionParam === 'last'
      ? -1 // Handle the "last" index
      : parseInt(positionParam + '', 10)

    if (isNaN(this.playlistPosition)) {
      logger.error(`playlistPosition query param '${positionParam}' was parsed as NaN, defaulting to 1.`)
      this.playlistPosition = 1
    }

    return true
  }

  private loadVideo (options: {
    videoId: string
    forceAutoplay: boolean
    liveRefresh?: boolean
    videoPassword?: string
  }) {
    const { videoId, liveRefresh, forceAutoplay, videoPassword } = options

    if (!liveRefresh && this.isSameElement(this.video, videoId)) return

    const videoObs = this.hooks.wrapObsFun(
      this.videoService.getVideo.bind(this.videoService),
      { videoId, videoPassword },
      'video-watch',
      'filter:api.video-watch.video.get.params',
      'filter:api.video-watch.video.get.result'
    )

    const videoAndLiveObs: Observable<{ video: VideoDetails, live?: LiveVideo, videoFileToken?: string }> = videoObs.pipe(
      switchMap(video => {
        if (!video.isLive) return of({ video, live: undefined })

        return this.liveVideoService.getVideoLive(video.uuid)
          .pipe(map(live => ({ live, video })))
      }),
      switchMap(({ video, live }) => {
        if (!videoRequiresFileToken(video)) return of({ video, live, videoFileToken: undefined })

        return this.videoFileTokenService.getVideoFileToken({ videoUUID: video.uuid, videoPassword })
          .pipe(map(({ token }) => ({ video, live, videoFileToken: token })))
      })
    )

    forkJoin([
      videoAndLiveObs,
      this.videoCaptionService.listCaptions(videoId, videoPassword),
      this.videoChapterService.getChapters({ videoId, videoPassword }),
      this.videoService.getStoryboards(videoId, videoPassword),
      this.playerSettingsService.getVideoSettings({ videoId, videoPassword, raw: false }),
      this.userService.getAnonymousOrLoggedUser()
    ]).subscribe({
      next: ([ { video, live, videoFileToken }, captionsResult, chaptersResult, storyboards, playerSettings, loggedInOrAnonymousUser ]) => {
        this.onVideoFetched({
          video,
          live,
          videoCaptions: captionsResult.data,
          videoChapters: chaptersResult.chapters,
          storyboards,
          videoFileToken,
          videoPassword,
          playerSettings,
          loggedInOrAnonymousUser,
          forceAutoplay
        }).catch(err => {
          this.handleGlobalError(err)
        })
      },
      error: async err => {
        if (err.body.code === ServerErrorCode.VIDEO_REQUIRES_PASSWORD || err.body.code === ServerErrorCode.INCORRECT_VIDEO_PASSWORD) {
          const { confirmed, password } = await this.handleVideoPasswordError(err)

          if (confirmed === false) return this.location.back()

          this.loadVideo({ ...options, videoPassword: password })
        } else {
          this.handleRequestError(err)
        }
      }
    })
  }

  private loadPlaylist (playlistId: string) {
    if (this.isSameElement(this.playlist, playlistId)) return

    this.playlistPosition = undefined
    this.noPlaylistVideoFound = false

    this.playlistService.getVideoPlaylist(playlistId)
      .subscribe({
        next: playlist => {
          this.playlist = playlist

          this.parsePlaylistPosition(this.route.snapshot.queryParams)

          this.videoWatchPlaylist().loadPlaylistElements({
            playlist,
            redirectToFirst: !this.playlistPosition,
            position: this.playlistPosition,
            reset: true
          })
        },

        error: err => this.handleRequestError(err)
      })
  }

  private isSameElement (element: VideoDetails | VideoPlaylist, newId: string) {
    if (!element) return false

    return (element.id + '') === newId || element.uuid === newId || element.shortUUID === newId
  }

  private async handleRequestError (err: any) {
    const errorBody = err.body as PeerTubeProblemDocument

    if (errorBody?.code === ServerErrorCode.DOES_NOT_RESPECT_FOLLOW_CONSTRAINTS && errorBody.originUrl) {
      const originUrl = errorBody.originUrl + (window.location.search ?? '')

      const res = await this.confirmService.confirm(
        // eslint-disable-next-line max-len
        $localize`This video is not available on ${this.serverConfig.instance.name}. Do you want to be redirected on the origin platform: <a href="${originUrl}">${originUrl}</a>?`,
        $localize`Redirection`
      )

      if (res === true) return window.location.href = originUrl
    }

    // If 400, 403 or 404, the video is private or blocked so redirect to 404
    return this.restExtractor.redirectTo404IfNotFound(err, 'video', [
      HttpStatusCode.BAD_REQUEST_400,
      HttpStatusCode.FORBIDDEN_403,
      HttpStatusCode.NOT_FOUND_404
    ])
  }

  private handleGlobalError (err: any) {
    const errorMessage: string = typeof err === 'string' ? err : err.message
    if (!errorMessage) return

    this.notifier.error(errorMessage)
  }

  private handleVideoPasswordError (err: any) {
    let isIncorrectPassword: boolean

    if (err.body.code === ServerErrorCode.VIDEO_REQUIRES_PASSWORD) {
      isIncorrectPassword = false
    } else if (err.body.code === ServerErrorCode.INCORRECT_VIDEO_PASSWORD) {
      this.videoPassword = undefined
      isIncorrectPassword = true
    }

    return this.confirmService.confirmWithPassword({
      message: $localize`You need a password to watch this video`,
      title: $localize`This video is password protected`,
      errorMessage: isIncorrectPassword ? $localize`Incorrect password, please enter a correct password` : ''
    })
  }

  private async onVideoFetched (options: {
    video: VideoDetails
    live: LiveVideo
    videoCaptions: VideoCaption[]
    videoChapters: VideoChapter[]
    storyboards: Storyboard[]
    videoFileToken: string
    videoPassword: string
    playerSettings: PlayerVideoSettings

    loggedInOrAnonymousUser: User
    forceAutoplay: boolean
  }) {
    const {
      video,
      live,
      videoCaptions,
      videoChapters,
      storyboards,
      videoFileToken,
      videoPassword,
      playerSettings,
      loggedInOrAnonymousUser,
      forceAutoplay
    } = options

    this.subscribeToLiveEventsIfNeeded(this.video, video)

    this.video = video
    this.videoCaptions = videoCaptions
    this.videoChapters = videoChapters
    this.liveVideo = live
    this.videoFileToken = videoFileToken
    this.videoPassword = videoPassword
    this.storyboards = storyboards
    this.playerSettings = playerSettings

    // Re init attributes
    this.remoteServerDown = false
    this.currentTime = undefined

    if (this.transcriptionWidgetOpened && this.videoCaptions.length === 0) {
      this.transcriptionWidgetOpened = false
    }

    if (this.video.isNSFWHiddenForUser(loggedInOrAnonymousUser, this.serverConfig)) {
      const res = await this.confirmService.confirm(
        $localize`This video contains sensitive content. Are you sure you want to display the video page?`,
        $localize`Sensitive video`,
        {
          confirmButtonText: $localize`Display the page`,
          cancelButtonText: $localize`Quit that page`,
          moreInfo: video.nsfwSummary
            ? {
              title: $localize`Learn more`,
              content: video.nsfwSummary
            }
            : undefined
        }
      )
      if (res === false) return this.location.back()
    }

    this.buildHotkeysHelp(video)
    this.setMetaTags(video)

    this.loadPlayer({ loggedInOrAnonymousUser, forceAutoplay })
      .catch(err => logger.error('Cannot build the player', err))

    const hookOptions = {
      videojs,
      video: this.video,
      playlist: this.playlist
    }
    this.hooks.runAction('action:video-watch.video.loaded', 'video-watch', hookOptions)
  }

  private async loadPlayer (options: {
    loggedInOrAnonymousUser: User
    forceAutoplay: boolean
  }) {
    const { loggedInOrAnonymousUser, forceAutoplay } = options

    const videoState = this.video.state.id
    if (videoState === VideoState.LIVE_ENDED || videoState === VideoState.WAITING_FOR_LIVE) {
      this.updatePlayerOnNoLive({ hasPlayed: false })
      return
    }

    this.peertubePlayer?.enable()

    const params = {
      video: this.video,
      videoCaptions: this.videoCaptions,
      videoChapters: this.videoChapters,
      storyboards: this.storyboards,
      liveVideo: this.liveVideo,
      videoFileToken: this.videoFileToken,
      videoPassword: this.videoPassword,
      playerSettings: this.playerSettings,
      urlOptions: this.getUrlOptions(),
      loggedInOrAnonymousUser,
      forceAutoplay,
      user: this.authUser
    }

    const loadOptions = await this.hooks.wrapFun(
      this.buildPeerTubePlayerLoadOptions.bind(this),
      params,
      'video-watch',
      'filter:internal.video-watch.player.load-options.params',
      'filter:internal.video-watch.player.load-options.result'
    )

    this.zone.runOutsideAngular(async () => {
      await this.peertubePlayer.load(loadOptions)

      const player = this.peertubePlayer.getPlayer()

      player.on('timeupdate', () => {
        const newTime = Math.floor(player.currentTime())

        // Update only if we have at least 1 second difference
        if (!this.currentTime || Math.abs(newTime - this.currentTime) >= 1) {
          debugLogger('Updating current time to ' + newTime)

          this.zone.run(() => this.currentTime = newTime)
        }
      })

      if (this.video.isLive) {
        player.one('ended', () => {
          this.zone.run(() => this.endLive())
        })
      }

      player.on('theater-change', (_: any, enabled: boolean) => {
        this.zone.run(() => this.theaterEnabled = enabled)
      })

      this.hooks.runAction('action:video-watch.player.loaded', 'video-watch', {
        player,
        playlist: this.playlist,
        playlistPosition: this.playlistPosition,
        videojs,
        video: this.video
      })
    })
  }

  private hasNextVideo () {
    if (this.playlist) {
      return this.videoWatchPlaylist().hasNextVideo()
    }

    return true
  }

  private getNextVideoTitle () {
    if (this.playlist) {
      return this.videoWatchPlaylist().getNextVideo()?.video?.name || ''
    }

    return this.nextRecommendedVideoTitle
  }

  private playNextVideoInAngularZone () {
    this.zone.run(() => {
      if (this.playlist) {
        this.videoWatchPlaylist().navigateToNextPlaylistVideo()
        return
      }

      if (this.nextRecommendedVideoId) {
        this.router.navigate([ '/w', this.nextRecommendedVideoId ])
      }
    })
  }

  private isAutoplay (video: Video, loggedInOrAnonymousUser: User) {
    // We'll jump to the thread id, so do not play the video
    if (this.route.snapshot.params['threadId']) return false

    // Prevent autoplay on NSFW hide/warn
    if (video.isNSFWHiddenOrWarned(loggedInOrAnonymousUser, this.serverConfig)) return false

    if (loggedInOrAnonymousUser) return loggedInOrAnonymousUser.autoPlayVideo

    throw new Error('Cannot guess autoplay because user and anonymousUser are not defined')
  }

  private buildPeerTubePlayerConstructorOptions (options: {
    urlOptions: URLOptions
  }): PeerTubePlayerConstructorOptions {
    const { urlOptions } = options

    return {
      playerElement: () => this.playerElement().nativeElement,

      enableHotkeys: true,
      inactivityTimeout: 2500,

      theaterButton: true,

      controls: urlOptions.controls,
      controlBar: urlOptions.controlBar,

      muted: urlOptions.muted,
      loop: urlOptions.loop,

      playbackRate: urlOptions.playbackRate,

      instanceName: this.serverConfig.instance.name,
      language: this.localeId,

      metricsUrl: this.serverConfig.openTelemetry.metrics.enabled
        ? environment.apiUrl + '/api/v1/metrics/playback'
        : null,
      metricsInterval: this.serverConfig.openTelemetry.metrics.playbackStatsInterval,

      videoViewIntervalMs: this.isUserLoggedIn()
        ? this.serverConfig.views.videos.watchingInterval.users
        : this.serverConfig.views.videos.watchingInterval.anonymous,

      authorizationHeader: () => this.authService.getRequestHeaderValue(),

      serverUrl: getAPIUrl(),
      stunServers: this.serverConfig.webrtc.stunServers,

      errorNotifier: (message: string) => this.notifier.error(message),

      peertubeLink: () => false,

      pluginsManager: this.pluginService.getPluginsManager(),

      autoPlayerRatio: {
        cssRatioVariable: '--co-player-ratio',
        cssPlayerPortraitModeVariable: '--co-player-portrait-mode'
      }
    }
  }

  private buildPeerTubePlayerLoadOptions (options: {
    video: VideoDetails
    liveVideo: LiveVideo
    videoCaptions: VideoCaption[]
    videoChapters: VideoChapter[]
    storyboards: Storyboard[]
    playerSettings: PlayerVideoSettings

    videoFileToken: string
    videoPassword: string

    urlOptions: URLOptions

    loggedInOrAnonymousUser: User
    forceAutoplay: boolean
    user?: AuthUser // Keep for plugins
  }): PeerTubePlayerLoadOptions {
    const {
      video,
      liveVideo,
      videoCaptions,
      videoChapters,
      storyboards,
      videoFileToken,
      videoPassword,
      urlOptions,
      loggedInOrAnonymousUser,
      forceAutoplay,
      playerSettings
    } = options

    let mode: PlayerMode

    if (urlOptions.playerMode) {
      if (urlOptions.playerMode === 'p2p-media-loader') mode = 'p2p-media-loader'
      else mode = 'web-video'
    } else {
      // eslint-disable-next-line no-lonely-if
      if (video.hasHlsPlaylist()) mode = 'p2p-media-loader'
      else mode = 'web-video'
    }

    let hlsOptions: HLSOptions
    if (video.hasHlsPlaylist()) {
      const hlsPlaylist = video.getHlsPlaylist()

      hlsOptions = {
        playlistUrl: hlsPlaylist.playlistUrl,
        segmentsSha256Url: hlsPlaylist.segmentsSha256Url,
        redundancyBaseUrls: hlsPlaylist.redundancies.map(r => r.baseUrl),
        trackerAnnounce: video.trackerUrls,
        videoFiles: hlsPlaylist.files
      }
    }

    const getStartTime = () => {
      if (video.isLive) return undefined

      const byUrl = urlOptions.startTime !== undefined
      const byHistory = video.userHistory && (!this.playlist || urlOptions.resume !== undefined)
      const byLocalStorage = getStoredVideoWatchHistory(video.uuid)

      if (byUrl) return timeToInt(urlOptions.startTime)

      let startTime = 0
      if (byHistory) startTime = video.userHistory.currentTime
      if (byLocalStorage) startTime = byLocalStorage.duration

      // If we are at the end of the video, reset the timer
      if (video.duration - startTime <= 1) startTime = 0

      return startTime
    }

    const startTime = getStartTime()

    const playerCaptions = videoCaptions.map(c => ({
      label: c.language.label,
      language: c.language.id,
      automaticallyGenerated: c.automaticallyGenerated,
      src: c.fileUrl
    }))

    const storyboard = storyboards.length !== 0
      ? {
        url: storyboards[0].fileUrl,
        height: storyboards[0].spriteHeight,
        width: storyboards[0].spriteWidth,
        interval: storyboards[0].spriteDuration
      }
      : undefined

    const liveOptions = video.isLive
      ? { latencyMode: liveVideo.latencyMode }
      : undefined

    return {
      mode,
      theme: urlOptions.playerTheme || playerSettings.theme as PlayerTheme,

      autoplay: this.isAutoplay(video, loggedInOrAnonymousUser),
      forceAutoplay,

      duration: video.duration,
      p2pEnabled: isP2PEnabled(video, this.serverConfig, loggedInOrAnonymousUser.p2pEnabled),

      startTime,
      stopTime: urlOptions.stopTime,

      subtitle: urlOptions.subtitle,

      embedUrl: video.embedUrl,
      embedTitle: video.name,

      isLive: video.isLive,
      liveOptions,

      videoViewUrl: this.videoService.getVideoViewUrl(video.uuid),

      videoFileToken: () => videoFileToken,
      requiresUserAuth: videoRequiresUserAuth(video, videoPassword),
      requiresPassword: video.privacy.id === VideoPrivacy.PASSWORD_PROTECTED &&
        !video.canBypassPassword(this.authUser),
      videoPassword: () => videoPassword,

      poster: video.isNSFWBlurForUser(loggedInOrAnonymousUser, this.serverConfig)
        ? null
        : video.previewUrl,

      nsfwWarning: video.isNSFWHiddenOrWarned(loggedInOrAnonymousUser, this.serverConfig)
        ? {
          flags: video.nsfwFlags,
          summary: video.nsfwSummary
        }
        : undefined,

      videoCaptions: playerCaptions,
      videoChapters,
      storyboard,

      videoShortUUID: video.shortUUID,
      videoUUID: video.uuid,

      videoRatio: video.aspectRatio,

      previousVideo: {
        enabled: this.playlist && this.videoWatchPlaylist().hasPreviousVideo(),

        handler: this.playlist
          ? () => this.zone.run(() => this.videoWatchPlaylist().navigateToPreviousPlaylistVideo())
          : undefined,

        displayControlBarButton: !!this.playlist
      },

      nextVideo: {
        enabled: this.hasNextVideo(),
        handler: () => this.playNextVideoInAngularZone(),
        getVideoTitle: () => this.getNextVideoTitle(),
        displayControlBarButton: this.hasNextVideo()
      },

      upnext: {
        isEnabled: () => {
          if (this.playlist) return loggedInOrAnonymousUser?.autoPlayNextVideoPlaylist

          return loggedInOrAnonymousUser?.autoPlayNextVideo
        },

        isSuspended: (player: VideojsPlayer) => {
          return !isXPercentInViewport(player.el() as HTMLElement, 80)
        },

        timeout: this.playlist
          ? 0 // Don't wait to play next video in playlist
          : 5000 // 5 seconds for a recommended video
      },

      hls: hlsOptions,

      webVideo: {
        videoFiles: video.files
      }
    }
  }

  private async subscribeToLiveEventsIfNeeded (oldVideo: VideoDetails, newVideo: VideoDetails) {
    if (!this.liveVideosSub) {
      this.liveVideosSub = this.buildLiveEventsSubscription()
    }

    if (oldVideo && oldVideo.id !== newVideo.id) {
      this.peertubeSocket.unsubscribeLiveVideos(oldVideo.id)
    }

    if (!newVideo.isLive) return

    await this.peertubeSocket.subscribeToLiveVideosSocket(newVideo.id)
  }

  private buildLiveEventsSubscription () {
    return this.peertubeSocket.getLiveVideosObservable()
      .subscribe(({ type, payload }) => {
        if (type === 'state-change') return this.handleLiveStateChange(payload.state)
        if (type === 'views-change') return this.handleLiveViewsChange(payload.viewers)
        if (type === 'force-end') return this.endLive()
      })
  }

  private handleLiveStateChange (newState: VideoStateType) {
    if (newState !== VideoState.PUBLISHED) return

    logger.info('Loading video after live update.')

    const videoUUID = this.video.uuid

    this.loadVideo({ videoId: videoUUID, forceAutoplay: true, liveRefresh: true })
  }

  private handleLiveViewsChange (newViewers: number) {
    if (!this.video) {
      logger.error('Cannot update video live views because video is no defined.')
      return
    }

    logger.info('Updating live views.')

    this.video.viewers = newViewers
  }

  private updatePlayerOnNoLive ({ hasPlayed }: { hasPlayed: boolean }) {
    this.peertubePlayer.unload()
    this.peertubePlayer.disable()

    if (hasPlayed || !this.video.isNSFWBlurForUser(this.authUser || this.anonymousUser, this.serverConfig)) {
      this.peertubePlayer.setPoster(this.video.previewPath)
    }
  }

  private buildHotkeysHelp (video: Video) {
    if (this.hotkeys.length !== 0) {
      this.hotkeysService.remove(this.hotkeys)
    }

    this.hotkeys = [
      // These hotkeys are managed by the player
      new Hotkey('f', e => e, $localize`Enter/exit fullscreen`),
      new Hotkey('space', e => e, $localize`Play/Pause the video`),
      new Hotkey('m', e => e, $localize`Mute/unmute the video`),

      new Hotkey('up', e => e, $localize`Increase the volume`),
      new Hotkey('down', e => e, $localize`Decrease the volume`),

      new Hotkey('t', e => {
        this.theaterEnabled = !this.theaterEnabled
        return false
      }, $localize`Toggle theater mode`)
    ]

    if (!video.isLive) {
      this.hotkeys = this.hotkeys.concat([
        // These hotkeys are also managed by the player but only for VOD

        new Hotkey('0-9', e => e, $localize`Skip to a percentage of the video: 0 is 0% and 9 is 90%`),

        new Hotkey('right', e => e, $localize`Seek the video forward`),
        new Hotkey('left', e => e, $localize`Seek the video backward`),

        new Hotkey('>', e => e, $localize`Increase playback rate`),
        new Hotkey('<', e => e, $localize`Decrease playback rate`),

        new Hotkey(',', e => e, $localize`Navigate in the video to the previous frame`),
        new Hotkey('.', e => e, $localize`Navigate in the video to the next frame`)
      ])
    }

    if (this.isUserLoggedIn()) {
      this.hotkeys = this.hotkeys.concat([
        new Hotkey('shift+s', () => {
          const subscribeButton = this.subscribeButton()
          if (subscribeButton.isSubscribedToAll()) subscribeButton.unsubscribe()
          else subscribeButton.subscribe()

          return false
        }, $localize`Subscribe to the account`)
      ])
    }

    this.hotkeysService.add(this.hotkeys)
  }

  private setMetaTags (video: Video) {
    this.metaService.setTitle(video.name)

    this.metaService.setDescription(video.description)

    this.metaService.setRSSFeeds(
      getVideoRSSFeeds({
        url: getOriginUrl(),
        video: { ...video, privacy: video.privacy.id },
        titles: {
          instanceVideosFeed: `${this.serverConfig.instance.name} - Videos feed`,
          videoCommentsFeed: `${video.name} - Comments feed`
        }
      })
    )
  }

  private getUrlOptions (): URLOptions {
    const queryParams = this.route.snapshot.queryParams

    return {
      resume: queryParams.resume,

      startTime: queryParams.start,
      stopTime: queryParams.stop,

      muted: toBoolean(queryParams.muted),
      loop: toBoolean(queryParams.loop),
      subtitle: queryParams.subtitle,

      playerMode: queryParams.mode,
      playerTheme: queryParams.playerTheme,
      playbackRate: queryParams.playbackRate,

      controlBar: toBoolean(queryParams.controlBar),

      peertubeLink: false
    }
  }

  private endLive () {
    // We changed the video, it's not a live anymore
    if (!this.video.isLive) return

    this.video.state.id = VideoState.LIVE_ENDED

    this.updatePlayerOnNoLive({ hasPlayed: true })
  }
}
