import { Hotkey, HotkeysService } from 'angular2-hotkeys'
import { forkJoin, map, Observable, of, Subscription, switchMap } from 'rxjs'
import { VideoJsPlayer } from 'video.js'
import { PlatformLocation } from '@angular/common'
import { Component, ElementRef, Inject, LOCALE_ID, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import {
  AuthService,
  AuthUser,
  ConfirmService,
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
import { isXPercentInViewport, scrollToTop } from '@app/helpers'
import { Video, VideoCaptionService, VideoDetails, VideoFileTokenService, VideoService } from '@app/shared/shared-main'
import { SubscribeButtonComponent } from '@app/shared/shared-user-subscription'
import { LiveVideoService } from '@app/shared/shared-video-live'
import { VideoPlaylist, VideoPlaylistService } from '@app/shared/shared-video-playlist'
import { logger } from '@root-helpers/logger'
import { isP2PEnabled, videoRequiresUserAuth, videoRequiresFileToken } from '@root-helpers/video'
import { timeToInt } from '@shared/core-utils'
import {
  HTMLServerConfig,
  HttpStatusCode,
  LiveVideo,
  PeerTubeProblemDocument,
  ServerErrorCode,
  Storyboard,
  VideoCaption,
  VideoPrivacy,
  VideoState
} from '@shared/models'
import {
  CustomizationOptions,
  P2PMediaLoaderOptions,
  PeertubePlayerManager,
  PeertubePlayerManagerOptions,
  PlayerMode,
  videojs
} from '../../../assets/player'
import { cleanupVideoWatch, getStoredTheater, getStoredVideoWatchHistory } from '../../../assets/player/peertube-player-local-storage'
import { environment } from '../../../environments/environment'
import { VideoWatchPlaylistComponent } from './shared'

type URLOptions = CustomizationOptions & { playerMode: PlayerMode }

@Component({
  selector: 'my-video-watch',
  templateUrl: './video-watch.component.html',
  styleUrls: [ './video-watch.component.scss' ]
})
export class VideoWatchComponent implements OnInit, OnDestroy {
  @ViewChild('videoWatchPlaylist', { static: true }) videoWatchPlaylist: VideoWatchPlaylistComponent
  @ViewChild('subscribeButton') subscribeButton: SubscribeButtonComponent

  player: VideoJsPlayer
  playerElement: HTMLVideoElement
  playerPlaceholderImgSrc: string
  theaterEnabled = false

  video: VideoDetails = null
  videoCaptions: VideoCaption[] = []
  liveVideo: LiveVideo
  videoPassword: string
  storyboards: Storyboard[] = []

  playlistPosition: number
  playlist: VideoPlaylist = null

  remoteServerDown = false
  noPlaylistVideoFound = false

  private nextVideoUUID = ''
  private nextVideoTitle = ''

  private videoFileToken: string

  private currentTime: number

  private paramsSub: Subscription
  private queryParamsSub: Subscription
  private configSub: Subscription
  private liveVideosSub: Subscription

  private serverConfig: HTMLServerConfig

  private hotkeys: Hotkey[] = []

  private static VIEW_VIDEO_INTERVAL_MS = 5000

  constructor (
    private elementRef: ElementRef,
    private route: ActivatedRoute,
    private router: Router,
    private videoService: VideoService,
    private playlistService: VideoPlaylistService,
    private liveVideoService: LiveVideoService,
    private confirmService: ConfirmService,
    private metaService: MetaService,
    private authService: AuthService,
    private userService: UserService,
    private serverService: ServerService,
    private restExtractor: RestExtractor,
    private notifier: Notifier,
    private zone: NgZone,
    private videoCaptionService: VideoCaptionService,
    private hotkeysService: HotkeysService,
    private hooks: HooksService,
    private pluginService: PluginService,
    private peertubeSocket: PeerTubeSocket,
    private screenService: ScreenService,
    private videoFileTokenService: VideoFileTokenService,
    private location: PlatformLocation,
    @Inject(LOCALE_ID) private localeId: string
  ) { }

  get user () {
    return this.authService.getUser()
  }

  get anonymousUser () {
    return this.userService.getAnonymousUser()
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    PeertubePlayerManager.initState()

    this.loadRouteParams()
    this.loadRouteQuery()

    this.theaterEnabled = getStoredTheater()

    this.hooks.runAction('action:video-watch.init', 'video-watch')

    setTimeout(cleanupVideoWatch, 1500) // Run in timeout to ensure we're not blocking the UI
  }

  ngOnDestroy () {
    this.flushPlayer()

    // Unsubscribe subscriptions
    if (this.paramsSub) this.paramsSub.unsubscribe()
    if (this.queryParamsSub) this.queryParamsSub.unsubscribe()
    if (this.configSub) this.configSub.unsubscribe()
    if (this.liveVideosSub) this.liveVideosSub.unsubscribe()

    // Unbind hotkeys
    this.hotkeysService.remove(this.hotkeys)
  }

  getCurrentTime () {
    return this.currentTime
  }

  getCurrentPlaylistPosition () {
    return this.videoWatchPlaylist.currentPlaylistPosition
  }

  onRecommendations (videos: Video[]) {
    if (videos.length === 0) return

    // The recommended videos's first element should be the next video
    const video = videos[0]
    this.nextVideoUUID = video.uuid
    this.nextVideoTitle = video.name
  }

  handleTimestampClicked (timestamp: number) {
    if (!this.player || this.video.isLive) return

    this.player.currentTime(timestamp)
    scrollToTop()
  }

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
    return this.video.isLocal === true && this.video.account.name === this.user?.username
  }

  isVideoBlur (video: Video) {
    return video.isVideoNSFWForUser(this.user, this.serverConfig)
  }

  isChannelDisplayNameGeneric () {
    const genericChannelDisplayName = [
      `Main ${this.video.channel.ownerAccount.name} channel`,
      `Default ${this.video.channel.ownerAccount.name} channel`
    ]

    return genericChannelDisplayName.includes(this.video.channel.displayName)
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
      // Handle the ?playlistPosition
      const positionParam = queryParams['playlistPosition'] ?? 1

      this.playlistPosition = positionParam === 'last'
        ? -1 // Handle the "last" index
        : parseInt(positionParam + '', 10)

      if (isNaN(this.playlistPosition)) {
        logger.error(`playlistPosition query param '${positionParam}' was parsed as NaN, defaulting to 1.`)
        this.playlistPosition = 1
      }

      this.videoWatchPlaylist.updatePlaylistIndex(this.playlistPosition)

      const start = queryParams['start']
      if (this.player && start) this.player.currentTime(parseInt(start, 10))
    })
  }

  private loadVideo (options: {
    videoId: string
    forceAutoplay: boolean
    videoPassword?: string
  }) {
    const { videoId, forceAutoplay, videoPassword } = options

    if (this.isSameElement(this.video, videoId)) return

    if (this.player) this.player.pause()

    this.video = undefined

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
      this.videoService.getStoryboards(videoId, videoPassword),
      this.userService.getAnonymousOrLoggedUser()
    ]).subscribe({
      next: ([ { video, live, videoFileToken }, captionsResult, storyboards, loggedInOrAnonymousUser ]) => {
        const queryParams = this.route.snapshot.queryParams

        const urlOptions = {
          resume: queryParams.resume,

          startTime: queryParams.start,
          stopTime: queryParams.stop,

          muted: queryParams.muted,
          loop: queryParams.loop,
          subtitle: queryParams.subtitle,

          playerMode: queryParams.mode,
          playbackRate: queryParams.playbackRate,
          peertubeLink: false
        }

        this.onVideoFetched({
          video,
          live,
          videoCaptions: captionsResult.data,
          storyboards,
          videoFileToken,
          videoPassword,
          loggedInOrAnonymousUser,
          urlOptions,
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

    this.noPlaylistVideoFound = false

    this.playlistService.getVideoPlaylist(playlistId)
      .subscribe({
        next: playlist => {
          this.playlist = playlist

          this.videoWatchPlaylist.loadPlaylistElements(playlist, !this.playlistPosition, this.playlistPosition)
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
        $localize`This video is not available on this instance. Do you want to be redirected on the origin instance: <a href="${originUrl}">${originUrl}</a>?`,
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

    // Display a message in the video player instead of a notification
    if (errorMessage.includes('from xs param')) {
      this.flushPlayer()
      this.remoteServerDown = true

      return
    }

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
    storyboards: Storyboard[]
    videoFileToken: string
    videoPassword: string

    urlOptions: URLOptions
    loggedInOrAnonymousUser: User
    forceAutoplay: boolean
  }) {
    const {
      video,
      live,
      videoCaptions,
      storyboards,
      urlOptions,
      videoFileToken,
      videoPassword,
      loggedInOrAnonymousUser,
      forceAutoplay
    } = options

    this.subscribeToLiveEventsIfNeeded(this.video, video)

    this.video = video
    this.videoCaptions = videoCaptions
    this.liveVideo = live
    this.videoFileToken = videoFileToken
    this.videoPassword = videoPassword
    this.storyboards = storyboards

    // Re init attributes
    this.playerPlaceholderImgSrc = undefined
    this.remoteServerDown = false
    this.currentTime = undefined

    if (this.isVideoBlur(this.video)) {
      const res = await this.confirmService.confirm(
        $localize`This video contains mature or explicit content. Are you sure you want to watch it?`,
        $localize`Mature or explicit content`
      )
      if (res === false) return this.location.back()
    }

    this.buildHotkeysHelp(video)

    this.buildPlayer({ urlOptions, loggedInOrAnonymousUser, forceAutoplay })
      .catch(err => logger.error('Cannot build the player', err))

    this.setOpenGraphTags()

    const hookOptions = {
      videojs,
      video: this.video,
      playlist: this.playlist
    }
    this.hooks.runAction('action:video-watch.video.loaded', 'video-watch', hookOptions)
  }

  private async buildPlayer (options: {
    urlOptions: URLOptions
    loggedInOrAnonymousUser: User
    forceAutoplay: boolean
  }) {
    const { urlOptions, loggedInOrAnonymousUser, forceAutoplay } = options

    // Flush old player if needed
    this.flushPlayer()

    const videoState = this.video.state.id
    if (videoState === VideoState.LIVE_ENDED || videoState === VideoState.WAITING_FOR_LIVE) {
      this.playerPlaceholderImgSrc = this.video.previewPath
      return
    }

    // Build video element, because videojs removes it on dispose
    const playerElementWrapper = this.elementRef.nativeElement.querySelector('#videojs-wrapper')
    this.playerElement = document.createElement('video')
    this.playerElement.className = 'video-js vjs-peertube-skin'
    this.playerElement.setAttribute('playsinline', 'true')
    playerElementWrapper.appendChild(this.playerElement)

    const params = {
      video: this.video,
      videoCaptions: this.videoCaptions,
      storyboards: this.storyboards,
      liveVideo: this.liveVideo,
      videoFileToken: this.videoFileToken,
      videoPassword: this.videoPassword,
      urlOptions,
      loggedInOrAnonymousUser,
      forceAutoplay,
      user: this.user
    }
    const { playerMode, playerOptions } = await this.hooks.wrapFun(
      this.buildPlayerManagerOptions.bind(this),
      params,
      'video-watch',
      'filter:internal.video-watch.player.build-options.params',
      'filter:internal.video-watch.player.build-options.result'
    )

    this.zone.runOutsideAngular(async () => {
      this.player = await PeertubePlayerManager.initialize(playerMode, playerOptions, player => this.player = player)

      this.player.on('customError', (_e, data: any) => {
        this.zone.run(() => this.handleGlobalError(data.err))
      })

      this.player.on('timeupdate', () => {
        // Don't need to trigger angular change for this variable, that is sent to children components on click
        this.currentTime = Math.floor(this.player.currentTime())
      })

      /**
       * condition: true to make the upnext functionality trigger, false to disable the upnext functionality
       *            go to the next video in 'condition()' if you don't want of the timer.
       * next: function triggered at the end of the timer.
       * suspended: function used at each click of the timer checking if we need to reset progress
       *            and wait until suspended becomes truthy again.
       */
      this.player.upnext({
        timeout: 5000, // 5s

        headText: $localize`Up Next`,
        cancelText: $localize`Cancel`,
        suspendedText: $localize`Autoplay is suspended`,

        getTitle: () => this.nextVideoTitle,

        next: () => this.zone.run(() => this.playNextVideoInAngularZone()),
        condition: () => {
          if (!this.playlist) return this.isAutoPlayNext()

          // Don't wait timeout to play the next playlist video
          if (this.isPlaylistAutoPlayNext()) {
            this.playNextVideoInAngularZone()
            return undefined
          }

          return false
        },

        suspended: () => {
          return (
            !isXPercentInViewport(this.player.el() as HTMLElement, 80) ||
            !document.getElementById('content').contains(document.activeElement)
          )
        }
      })

      this.player.one('stopped', () => {
        if (this.playlist && this.isPlaylistAutoPlayNext()) {
          this.playNextVideoInAngularZone()
        }
      })

      this.player.one('ended', () => {
        if (this.video.isLive) {
          this.zone.run(() => this.video.state.id = VideoState.LIVE_ENDED)
        }
      })

      this.player.on('theaterChange', (_: any, enabled: boolean) => {
        this.zone.run(() => this.theaterEnabled = enabled)
      })

      this.hooks.runAction('action:video-watch.player.loaded', 'video-watch', {
        player: this.player,
        playlist: this.playlist,
        playlistPosition: this.playlistPosition,
        videojs,
        video: this.video
      })
    })
  }

  private hasNextVideo () {
    if (this.playlist) {
      return this.videoWatchPlaylist.hasNextVideo()
    }

    return true
  }

  private playNextVideoInAngularZone () {
    if (this.playlist) {
      this.zone.run(() => this.videoWatchPlaylist.navigateToNextPlaylistVideo())
      return
    }

    if (this.nextVideoUUID) {
      this.router.navigate([ '/w', this.nextVideoUUID ])
    }
  }

  private isAutoplay () {
    // We'll jump to the thread id, so do not play the video
    if (this.route.snapshot.params['threadId']) return false

    // Otherwise true by default
    if (!this.user) return true

    // Be sure the autoPlay is set to false
    return this.user.autoPlayVideo !== false
  }

  private isAutoPlayNext () {
    return (
      (this.user?.autoPlayNextVideo) ||
      this.anonymousUser.autoPlayNextVideo
    )
  }

  private isPlaylistAutoPlayNext () {
    return (
      (this.user?.autoPlayNextVideoPlaylist) ||
      this.anonymousUser.autoPlayNextVideoPlaylist
    )
  }

  private flushPlayer () {
    // Remove player if it exists
    if (!this.player) return

    try {
      this.player.dispose()
      this.player = undefined
    } catch (err) {
      logger.error('Cannot dispose player.', err)
    }
  }

  private buildPlayerManagerOptions (params: {
    video: VideoDetails
    liveVideo: LiveVideo
    videoCaptions: VideoCaption[]
    storyboards: Storyboard[]

    videoFileToken: string
    videoPassword: string

    urlOptions: CustomizationOptions & { playerMode: PlayerMode }

    loggedInOrAnonymousUser: User
    forceAutoplay: boolean
    user?: AuthUser // Keep for plugins
  }) {
    const {
      video,
      liveVideo,
      videoCaptions,
      storyboards,
      videoFileToken,
      videoPassword,
      urlOptions,
      loggedInOrAnonymousUser,
      forceAutoplay
    } = params

    const getStartTime = () => {
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
      src: environment.apiUrl + c.captionPath
    }))

    const storyboard = storyboards.length !== 0
      ? {
        url: environment.apiUrl + storyboards[0].storyboardPath,
        height: storyboards[0].spriteHeight,
        width: storyboards[0].spriteWidth,
        interval: storyboards[0].spriteDuration
      }
      : undefined

    const liveOptions = video.isLive
      ? { latencyMode: liveVideo.latencyMode }
      : undefined

    const options: PeertubePlayerManagerOptions = {
      common: {
        autoplay: this.isAutoplay(),
        forceAutoplay,
        p2pEnabled: isP2PEnabled(video, this.serverConfig, loggedInOrAnonymousUser.p2pEnabled),

        hasNextVideo: () => this.hasNextVideo(),
        nextVideo: () => this.playNextVideoInAngularZone(),

        playerElement: this.playerElement,
        onPlayerElementChange: (element: HTMLVideoElement) => this.playerElement = element,

        videoDuration: video.duration,
        enableHotkeys: true,
        inactivityTimeout: 2500,
        poster: video.previewUrl,

        startTime,
        stopTime: urlOptions.stopTime,
        controlBar: urlOptions.controlBar,
        controls: urlOptions.controls,
        muted: urlOptions.muted,
        loop: urlOptions.loop,
        subtitle: urlOptions.subtitle,
        playbackRate: urlOptions.playbackRate,

        peertubeLink: urlOptions.peertubeLink,

        theaterButton: true,
        captions: videoCaptions.length !== 0,

        embedUrl: video.embedUrl,
        embedTitle: video.name,
        instanceName: this.serverConfig.instance.name,

        isLive: video.isLive,
        liveOptions,

        language: this.localeId,

        metricsUrl: environment.apiUrl + '/api/v1/metrics/playback',

        videoViewUrl: video.privacy.id !== VideoPrivacy.PRIVATE
          ? this.videoService.getVideoViewUrl(video.uuid)
          : null,
        videoViewIntervalMs: VideoWatchComponent.VIEW_VIDEO_INTERVAL_MS,
        authorizationHeader: () => this.authService.getRequestHeaderValue(),

        serverUrl: environment.originServerUrl || window.location.origin,

        videoFileToken: () => videoFileToken,
        requiresUserAuth: videoRequiresUserAuth(video, videoPassword),
        requiresPassword: video.privacy.id === VideoPrivacy.PASSWORD_PROTECTED &&
          !video.canAccessPasswordProtectedVideoWithoutPassword(this.user),
        videoPassword: () => videoPassword,

        videoCaptions: playerCaptions,
        storyboard,

        videoShortUUID: video.shortUUID,
        videoUUID: video.uuid,

        errorNotifier: (message: string) => this.notifier.error(message)
      },

      webtorrent: {
        videoFiles: video.files
      },

      pluginsManager: this.pluginService.getPluginsManager()
    }

    // Only set this if we're in a playlist
    if (this.playlist) {
      options.common.hasPreviousVideo = () => this.videoWatchPlaylist.hasPreviousVideo()

      options.common.previousVideo = () => {
        this.zone.run(() => this.videoWatchPlaylist.navigateToPreviousPlaylistVideo())
      }
    }

    let mode: PlayerMode

    if (urlOptions.playerMode) {
      if (urlOptions.playerMode === 'p2p-media-loader') mode = 'p2p-media-loader'
      else mode = 'webtorrent'
    } else {
      if (video.hasHlsPlaylist()) mode = 'p2p-media-loader'
      else mode = 'webtorrent'
    }

    // FIXME: remove, we don't support these old web browsers anymore
    // p2p-media-loader needs TextEncoder, fallback on WebTorrent if not available
    if (typeof TextEncoder === 'undefined') {
      mode = 'webtorrent'
    }

    if (mode === 'p2p-media-loader') {
      const hlsPlaylist = video.getHlsPlaylist()

      const p2pMediaLoader = {
        playlistUrl: hlsPlaylist.playlistUrl,
        segmentsSha256Url: hlsPlaylist.segmentsSha256Url,
        redundancyBaseUrls: hlsPlaylist.redundancies.map(r => r.baseUrl),
        trackerAnnounce: video.trackerUrls,
        videoFiles: hlsPlaylist.files
      } as P2PMediaLoaderOptions

      Object.assign(options, { p2pMediaLoader })
    }

    return { playerMode: mode, playerOptions: options }
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
      })
  }

  private handleLiveStateChange (newState: VideoState) {
    if (newState !== VideoState.PUBLISHED) return

    logger.info('Loading video after live update.')

    const videoUUID = this.video.uuid

    // Reset to force refresh the video
    this.video = undefined
    this.loadVideo({ videoId: videoUUID, forceAutoplay: true })
  }

  private handleLiveViewsChange (newViewers: number) {
    if (!this.video) {
      logger.error('Cannot update video live views because video is no defined.')
      return
    }

    logger.info('Updating live views.')

    this.video.viewers = newViewers
  }

  private buildHotkeysHelp (video: Video) {
    if (this.hotkeys.length !== 0) {
      this.hotkeysService.remove(this.hotkeys)
    }

    this.hotkeys = [
      // These hotkeys are managed by the player
      new Hotkey('f', e => e, undefined, $localize`Enter/exit fullscreen`),
      new Hotkey('space', e => e, undefined, $localize`Play/Pause the video`),
      new Hotkey('m', e => e, undefined, $localize`Mute/unmute the video`),

      new Hotkey('up', e => e, undefined, $localize`Increase the volume`),
      new Hotkey('down', e => e, undefined, $localize`Decrease the volume`),

      new Hotkey('t', e => {
        this.theaterEnabled = !this.theaterEnabled
        return false
      }, undefined, $localize`Toggle theater mode`)
    ]

    if (!video.isLive) {
      this.hotkeys = this.hotkeys.concat([
        // These hotkeys are also managed by the player but only for VOD

        new Hotkey('0-9', e => e, undefined, $localize`Skip to a percentage of the video: 0 is 0% and 9 is 90%`),

        new Hotkey('right', e => e, undefined, $localize`Seek the video forward`),
        new Hotkey('left', e => e, undefined, $localize`Seek the video backward`),

        new Hotkey('>', e => e, undefined, $localize`Increase playback rate`),
        new Hotkey('<', e => e, undefined, $localize`Decrease playback rate`),

        new Hotkey(',', e => e, undefined, $localize`Navigate in the video to the previous frame`),
        new Hotkey('.', e => e, undefined, $localize`Navigate in the video to the next frame`)
      ])
    }

    if (this.isUserLoggedIn()) {
      this.hotkeys = this.hotkeys.concat([
        new Hotkey('shift+s', () => {
          if (this.subscribeButton.isSubscribedToAll()) this.subscribeButton.unsubscribe()
          else this.subscribeButton.subscribe()

          return false
        }, undefined, $localize`Subscribe to the account`)
      ])
    }

    this.hotkeysService.add(this.hotkeys)
  }

  private setOpenGraphTags () {
    this.metaService.setTitle(this.video.name)

    this.metaService.setTag('og:type', 'video')

    this.metaService.setTag('og:title', this.video.name)
    this.metaService.setTag('name', this.video.name)

    this.metaService.setTag('og:description', this.video.description)
    this.metaService.setTag('description', this.video.description)

    this.metaService.setTag('og:image', this.video.previewPath)

    this.metaService.setTag('og:duration', this.video.duration.toString())

    this.metaService.setTag('og:site_name', 'PeerTube')

    this.metaService.setTag('og:url', window.location.href)
    this.metaService.setTag('url', window.location.href)
  }
}
