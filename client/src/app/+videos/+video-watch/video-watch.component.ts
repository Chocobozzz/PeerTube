import { Hotkey, HotkeysService } from 'angular2-hotkeys'
import { forkJoin, Subscription } from 'rxjs'
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
  UserService
} from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { isXPercentInViewport, scrollToTop } from '@app/helpers'
import { Video, VideoCaptionService, VideoDetails, VideoService } from '@app/shared/shared-main'
import { SubscribeButtonComponent } from '@app/shared/shared-user-subscription'
import { VideoPlaylist, VideoPlaylistService } from '@app/shared/shared-video-playlist'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'
import { HTMLServerConfig, PeerTubeProblemDocument, ServerErrorCode, VideoCaption, VideoPrivacy, VideoState } from '@shared/models'
import { cleanupVideoWatch, getStoredTheater, getStoredVideoWatchHistory } from '../../../assets/player/peertube-player-local-storage'
import {
  CustomizationOptions,
  P2PMediaLoaderOptions,
  PeertubePlayerManager,
  PeertubePlayerManagerOptions,
  PlayerMode,
  videojs
} from '../../../assets/player/peertube-player-manager'
import { timeToInt } from '../../../assets/player/utils'
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

  player: any
  playerElement: HTMLVideoElement
  playerPlaceholderImgSrc: string
  theaterEnabled = false

  video: VideoDetails = null
  videoCaptions: VideoCaption[] = []

  playlistPosition: number
  playlist: VideoPlaylist = null

  remoteServerDown = false

  private nextVideoUUID = ''
  private nextVideoTitle = ''

  private currentTime: number

  private paramsSub: Subscription
  private queryParamsSub: Subscription
  private configSub: Subscription
  private liveVideosSub: Subscription

  private serverConfig: HTMLServerConfig

  private hotkeys: Hotkey[] = []

  constructor (
    private elementRef: ElementRef,
    private route: ActivatedRoute,
    private router: Router,
    private videoService: VideoService,
    private playlistService: VideoPlaylistService,
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
    private location: PlatformLocation,
    @Inject(LOCALE_ID) private localeId: string
  ) { }

  get user () {
    return this.authService.getUser()
  }

  get anonymousUser () {
    return this.userService.getAnonymousUser()
  }

  async ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    PeertubePlayerManager.initState()

    this.loadRouteParams()
    this.loadRouteQuery()

    this.initHotkeys()

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
    this.loadVideo(videoId)
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
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
      const videoId = routeParams[ 'videoId' ]
      if (videoId) return this.loadVideo(videoId)

      const playlistId = routeParams[ 'playlistId' ]
      if (playlistId) return this.loadPlaylist(playlistId)
    })
  }

  private loadRouteQuery () {
    this.queryParamsSub = this.route.queryParams.subscribe(queryParams => {
      // Handle the ?playlistPosition
      const positionParam = queryParams[ 'playlistPosition' ] ?? 1

      this.playlistPosition = positionParam === 'last'
        ? -1 // Handle the "last" index
        : parseInt(positionParam + '', 10)

      if (isNaN(this.playlistPosition)) {
        console.error(`playlistPosition query param '${positionParam}' was parsed as NaN, defaulting to 1.`)
        this.playlistPosition = 1
      }

      this.videoWatchPlaylist.updatePlaylistIndex(this.playlistPosition)

      const start = queryParams[ 'start' ]
      if (this.player && start) this.player.currentTime(parseInt(start, 10))
    })
  }

  private loadVideo (videoId: string) {
    if (this.isSameElement(this.video, videoId)) return

    if (this.player) this.player.pause()

    const videoObs = this.hooks.wrapObsFun(
      this.videoService.getVideo.bind(this.videoService),
      { videoId },
      'video-watch',
      'filter:api.video-watch.video.get.params',
      'filter:api.video-watch.video.get.result'
    )

    forkJoin([ videoObs, this.videoCaptionService.listCaptions(videoId)])
      .subscribe(
        ([ video, captionsResult ]) => {
          const queryParams = this.route.snapshot.queryParams

          const urlOptions = {
            resume: queryParams.resume,

            startTime: queryParams.start,
            stopTime: queryParams.stop,

            muted: queryParams.muted,
            loop: queryParams.loop,
            subtitle: queryParams.subtitle,

            playerMode: queryParams.mode,
            peertubeLink: false
          }

          this.onVideoFetched(video, captionsResult.data, urlOptions)
              .catch(err => this.handleGlobalError(err))
        },

        err => this.handleRequestError(err)
      )
  }

  private loadPlaylist (playlistId: string) {
    if (this.isSameElement(this.playlist, playlistId)) return

    this.playlistService.getVideoPlaylist(playlistId)
      .subscribe(
        playlist => {
          this.playlist = playlist

          this.videoWatchPlaylist.loadPlaylistElements(playlist, !this.playlistPosition, this.playlistPosition)
        },

        err => this.handleRequestError(err)
      )
  }

  private isSameElement (element: VideoDetails | VideoPlaylist, newId: string) {
    if (!element) return false

    return (element.id + '') === newId || element.uuid === newId || element.shortUUID === newId
  }

  private async handleRequestError (err: any) {
    const errorBody = err.body as PeerTubeProblemDocument

    if (errorBody.code === ServerErrorCode.DOES_NOT_RESPECT_FOLLOW_CONSTRAINTS && errorBody.originUrl) {
      const originUrl = errorBody.originUrl + (window.location.search ?? '')

      const res = await this.confirmService.confirm(
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
    if (errorMessage.indexOf('from xs param') !== -1) {
      this.flushPlayer()
      this.remoteServerDown = true

      return
    }

    this.notifier.error(errorMessage)
  }

  private async onVideoFetched (
    video: VideoDetails,
    videoCaptions: VideoCaption[],
    urlOptions: URLOptions
  ) {
    this.subscribeToLiveEventsIfNeeded(this.video, video)

    this.video = video
    this.videoCaptions = videoCaptions

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

    this.buildPlayer(urlOptions)
      .catch(err => console.error('Cannot build the player', err))

    this.setOpenGraphTags()

    const hookOptions = {
      videojs,
      video: this.video,
      playlist: this.playlist
    }
    this.hooks.runAction('action:video-watch.video.loaded', 'video-watch', hookOptions)
  }

  private async buildPlayer (urlOptions: URLOptions) {
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
      urlOptions,
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

      this.player.on('customError', ({ err }: { err: any }) => {
        this.zone.run(() => this.handleGlobalError(err))
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
            !isXPercentInViewport(this.player.el(), 80) ||
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

      this.hooks.runAction('action:video-watch.player.loaded', 'video-watch', { player: this.player, videojs, video: this.video })
    })
  }

  private playNextVideoInAngularZone () {
    if (this.playlist) {
      this.zone.run(() => this.videoWatchPlaylist.navigateToNextPlaylistVideo())
      return
    }

    if (this.nextVideoUUID) {
      this.router.navigate([ '/w', this.nextVideoUUID ])
      return
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
      (this.user && this.user.autoPlayNextVideo) ||
      this.anonymousUser.autoPlayNextVideo
    )
  }

  private isPlaylistAutoPlayNext () {
    return (
      (this.user && this.user.autoPlayNextVideoPlaylist) ||
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
      console.error('Cannot dispose player.', err)
    }
  }

  private buildPlayerManagerOptions (params: {
    video: VideoDetails,
    videoCaptions: VideoCaption[],
    urlOptions: CustomizationOptions & { playerMode: PlayerMode },
    user?: AuthUser
  }) {
    const { video, videoCaptions, urlOptions, user } = params

    const getStartTime = () => {
      const byUrl = urlOptions.startTime !== undefined
      const byHistory = video.userHistory && (!this.playlist || urlOptions.resume !== undefined)
      const byLocalStorage = getStoredVideoWatchHistory(video.uuid)

      if (byUrl) return timeToInt(urlOptions.startTime)
      if (byHistory) return video.userHistory.currentTime
      if (byLocalStorage) return byLocalStorage.duration

      return 0
    }

    let startTime = getStartTime()

    // If we are at the end of the video, reset the timer
    if (video.duration - startTime <= 1) startTime = 0

    const playerCaptions = videoCaptions.map(c => ({
      label: c.language.label,
      language: c.language.id,
      src: environment.apiUrl + c.captionPath
    }))

    const options: PeertubePlayerManagerOptions = {
      common: {
        autoplay: this.isAutoplay(),
        nextVideo: () => this.playNextVideoInAngularZone(),

        playerElement: this.playerElement,
        onPlayerElementChange: (element: HTMLVideoElement) => this.playerElement = element,

        videoDuration: video.duration,
        enableHotkeys: true,
        inactivityTimeout: 2500,
        poster: video.previewUrl,

        startTime,
        stopTime: urlOptions.stopTime,
        controls: urlOptions.controls,
        muted: urlOptions.muted,
        loop: urlOptions.loop,
        subtitle: urlOptions.subtitle,

        peertubeLink: urlOptions.peertubeLink,

        theaterButton: true,
        captions: videoCaptions.length !== 0,

        videoViewUrl: video.privacy.id !== VideoPrivacy.PRIVATE
          ? this.videoService.getVideoViewUrl(video.uuid)
          : null,
        embedUrl: video.embedUrl,
        embedTitle: video.name,

        isLive: video.isLive,

        language: this.localeId,

        userWatching: user && user.videosHistoryEnabled === true ? {
          url: this.videoService.getUserWatchingVideoUrl(video.uuid),
          authorizationHeader: this.authService.getRequestHeaderValue()
        } : undefined,

        serverUrl: environment.apiUrl,

        videoCaptions: playerCaptions,

        videoUUID: video.uuid
      },

      webtorrent: {
        videoFiles: video.files
      },

      pluginsManager: this.pluginService.getPluginsManager()
    }

    // Only set this if we're in a playlist
    if (this.playlist) {
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
      await this.peertubeSocket.unsubscribeLiveVideos(oldVideo.id)
    }

    if (!newVideo.isLive) return

    await this.peertubeSocket.subscribeToLiveVideosSocket(newVideo.id)
  }

  private buildLiveEventsSubscription () {
    return this.peertubeSocket.getLiveVideosObservable()
      .subscribe(({ type, payload }) => {
        if (type === 'state-change') return this.handleLiveStateChange(payload.state)
        if (type === 'views-change') return this.handleLiveViewsChange(payload.views)
      })
  }

  private handleLiveStateChange (newState: VideoState) {
    if (newState !== VideoState.PUBLISHED) return

    const videoState = this.video.state.id
    if (videoState !== VideoState.WAITING_FOR_LIVE && videoState !== VideoState.LIVE_ENDED) return

    console.log('Loading video after live update.')

    const videoUUID = this.video.uuid

    // Reset to force refresh the video
    this.video = undefined
    this.loadVideo(videoUUID)
  }

  private handleLiveViewsChange (newViews: number) {
    if (!this.video) {
      console.error('Cannot update video live views because video is no defined.')
      return
    }

    console.log('Updating live views.')

    this.video.views = newViews
  }

  private initHotkeys () {
    this.hotkeys = [
      // These hotkeys are managed by the player
      new Hotkey('f', e => e, undefined, $localize`Enter/exit fullscreen (requires player focus)`),
      new Hotkey('space', e => e, undefined, $localize`Play/Pause the video (requires player focus)`),
      new Hotkey('m', e => e, undefined, $localize`Mute/unmute the video (requires player focus)`),

      new Hotkey('0-9', e => e, undefined, $localize`Skip to a percentage of the video: 0 is 0% and 9 is 90% (requires player focus)`),

      new Hotkey('up', e => e, undefined, $localize`Increase the volume (requires player focus)`),
      new Hotkey('down', e => e, undefined, $localize`Decrease the volume (requires player focus)`),

      new Hotkey('right', e => e, undefined, $localize`Seek the video forward (requires player focus)`),
      new Hotkey('left', e => e, undefined, $localize`Seek the video backward (requires player focus)`),

      new Hotkey('>', e => e, undefined, $localize`Increase playback rate (requires player focus)`),
      new Hotkey('<', e => e, undefined, $localize`Decrease playback rate (requires player focus)`),

      new Hotkey('.', e => e, undefined, $localize`Navigate in the video frame by frame (requires player focus)`)
    ]

    if (this.isUserLoggedIn()) {
      this.hotkeys = this.hotkeys.concat([
        new Hotkey('shift+s', () => {
          this.subscribeButton.isSubscribedToAll()
            ? this.subscribeButton.unsubscribe()
            : this.subscribeButton.subscribe()

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
