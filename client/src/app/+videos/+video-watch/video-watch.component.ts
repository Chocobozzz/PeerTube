import { Hotkey, HotkeysService } from 'angular2-hotkeys'
import { forkJoin, Observable, Subscription } from 'rxjs'
import { catchError } from 'rxjs/operators'
import { PlatformLocation } from '@angular/common'
import { ChangeDetectorRef, Component, ElementRef, Inject, LOCALE_ID, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import {
  AuthService,
  AuthUser,
  ConfirmService,
  MarkdownService,
  Notifier,
  PeerTubeSocket,
  RestExtractor,
  ServerService,
  UserService
} from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { RedirectService } from '@app/core/routing/redirect.service'
import { isXPercentInViewport, scrollToTop } from '@app/helpers'
import { Video, VideoCaptionService, VideoDetails, VideoService } from '@app/shared/shared-main'
import { VideoShareComponent } from '@app/shared/shared-share-modal'
import { SubscribeButtonComponent } from '@app/shared/shared-user-subscription'
import { VideoActionsDisplayType, VideoDownloadComponent } from '@app/shared/shared-video-miniature'
import { VideoPlaylist, VideoPlaylistService } from '@app/shared/shared-video-playlist'
import { MetaService } from '@ngx-meta/core'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'
import { ServerConfig, ServerErrorCode, UserVideoRateType, VideoCaption, VideoPrivacy, VideoState } from '@shared/models'
import { getStoredP2PEnabled, getStoredTheater } from '../../../assets/player/peertube-player-local-storage'
import {
  CustomizationOptions,
  P2PMediaLoaderOptions,
  PeertubePlayerManager,
  PeertubePlayerManagerOptions,
  PlayerMode,
  videojs
} from '../../../assets/player/peertube-player-manager'
import { isWebRTCDisabled, timeToInt } from '../../../assets/player/utils'
import { environment } from '../../../environments/environment'
import { VideoSupportComponent } from './modal/video-support.component'
import { VideoWatchPlaylistComponent } from './video-watch-playlist.component'

type URLOptions = CustomizationOptions & { playerMode: PlayerMode }

@Component({
  selector: 'my-video-watch',
  templateUrl: './video-watch.component.html',
  styleUrls: [ './video-watch.component.scss' ]
})
export class VideoWatchComponent implements OnInit, OnDestroy {
  private static LOCAL_STORAGE_PRIVACY_CONCERN_KEY = 'video-watch-privacy-concern'

  @ViewChild('videoWatchPlaylist', { static: true }) videoWatchPlaylist: VideoWatchPlaylistComponent
  @ViewChild('videoShareModal') videoShareModal: VideoShareComponent
  @ViewChild('videoSupportModal') videoSupportModal: VideoSupportComponent
  @ViewChild('subscribeButton') subscribeButton: SubscribeButtonComponent
  @ViewChild('videoDownloadModal') videoDownloadModal: VideoDownloadComponent

  player: any
  playerElement: HTMLVideoElement
  theaterEnabled = false
  userRating: UserVideoRateType = null
  descriptionLoading = false

  video: VideoDetails = null
  videoCaptions: VideoCaption[] = []

  playlistPosition: number
  playlist: VideoPlaylist = null

  completeDescriptionShown = false
  completeVideoDescription: string
  shortVideoDescription: string
  videoHTMLDescription = ''
  likesBarTooltipText = ''
  hasAlreadyAcceptedPrivacyConcern = false
  remoteServerDown = false
  hotkeys: Hotkey[] = []

  tooltipLike = ''
  tooltipDislike = ''
  tooltipSupport = ''
  tooltipSaveToPlaylist = ''

  videoActionsOptions: VideoActionsDisplayType = {
    playlist: false,
    download: true,
    update: true,
    blacklist: true,
    delete: true,
    report: true,
    duplicate: true,
    mute: true,
    liveInfo: true
  }

  private nextVideoUuid = ''
  private nextVideoTitle = ''
  private currentTime: number
  private paramsSub: Subscription
  private queryParamsSub: Subscription
  private configSub: Subscription
  private liveVideosSub: Subscription

  private serverConfig: ServerConfig

  constructor (
    private elementRef: ElementRef,
    private changeDetector: ChangeDetectorRef,
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
    private markdownService: MarkdownService,
    private zone: NgZone,
    private redirectService: RedirectService,
    private videoCaptionService: VideoCaptionService,
    private hotkeysService: HotkeysService,
    private hooks: HooksService,
    private peertubeSocket: PeerTubeSocket,
    private location: PlatformLocation,
    @Inject(LOCALE_ID) private localeId: string
  ) {
    this.tooltipLike = $localize`Like this video`
    this.tooltipDislike = $localize`Dislike this video`
    this.tooltipSupport = $localize`Support options for this video`
    this.tooltipSaveToPlaylist = $localize`Save to playlist`
  }

  get user () {
    return this.authService.getUser()
  }

  get anonymousUser () {
    return this.userService.getAnonymousUser()
  }

  async ngOnInit () {
    PeertubePlayerManager.initState()

    this.serverConfig = this.serverService.getTmpConfig()

    this.configSub = this.serverService.getConfig()
        .subscribe(config => {
          this.serverConfig = config

          if (
            isWebRTCDisabled() ||
            this.serverConfig.tracker.enabled === false ||
            getStoredP2PEnabled() === false ||
            peertubeLocalStorage.getItem(VideoWatchComponent.LOCAL_STORAGE_PRIVACY_CONCERN_KEY) === 'true'
          ) {
            this.hasAlreadyAcceptedPrivacyConcern = true
          }
        })

    this.paramsSub = this.route.params.subscribe(routeParams => {
      const videoId = routeParams[ 'videoId' ]
      if (videoId) this.loadVideo(videoId)

      const playlistId = routeParams[ 'playlistId' ]
      if (playlistId) this.loadPlaylist(playlistId)
    })

    this.queryParamsSub = this.route.queryParams.subscribe(queryParams => {
      this.playlistPosition = queryParams[ 'playlistPosition' ]
      this.videoWatchPlaylist.updatePlaylistIndex(this.playlistPosition)

      const start = queryParams[ 'start' ]
      if (this.player && start) this.player.currentTime(parseInt(start, 10))
    })

    this.initHotkeys()

    this.theaterEnabled = getStoredTheater()

    this.hooks.runAction('action:video-watch.init', 'video-watch')
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

  setLike () {
    if (this.isUserLoggedIn() === false) return

    // Already liked this video
    if (this.userRating === 'like') this.setRating('none')
    else this.setRating('like')
  }

  setDislike () {
    if (this.isUserLoggedIn() === false) return

    // Already disliked this video
    if (this.userRating === 'dislike') this.setRating('none')
    else this.setRating('dislike')
  }

  getRatePopoverText () {
    if (this.isUserLoggedIn()) return undefined

    return $localize`You need to be <a href="/login">logged in</a> to rate this video.`
  }

  showMoreDescription () {
    if (this.completeVideoDescription === undefined) {
      return this.loadCompleteDescription()
    }

    this.updateVideoDescription(this.completeVideoDescription)
    this.completeDescriptionShown = true
  }

  showLessDescription () {
    this.updateVideoDescription(this.shortVideoDescription)
    this.completeDescriptionShown = false
  }

  showDownloadModal () {
    this.videoDownloadModal.show(this.video, this.videoCaptions)
  }

  isVideoDownloadable () {
    return this.video && this.video instanceof VideoDetails && this.video.downloadEnabled && !this.video.isLive
  }

  loadCompleteDescription () {
    this.descriptionLoading = true

    this.videoService.loadCompleteDescription(this.video.descriptionPath)
        .subscribe(
          description => {
            this.completeDescriptionShown = true
            this.descriptionLoading = false

            this.shortVideoDescription = this.video.description
            this.completeVideoDescription = description

            this.updateVideoDescription(this.completeVideoDescription)
          },

          error => {
            this.descriptionLoading = false
            this.notifier.error(error.message)
          }
        )
  }

  showSupportModal () {
    // Check video was playing before opening support modal
    const isVideoPlaying = this.isPlaying()

    this.pausePlayer()

    const modalRef = this.videoSupportModal.show()

    modalRef.result.then(() => {
      if (isVideoPlaying) {
        this.resumePlayer()
      }
    })
  }

  showShareModal () {
    this.pausePlayer()

    this.videoShareModal.show(this.currentTime, this.videoWatchPlaylist.currentPlaylistPosition)
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  getVideoTags () {
    if (!this.video || Array.isArray(this.video.tags) === false) return []

    return this.video.tags
  }

  onRecommendations (videos: Video[]) {
    if (videos.length > 0) {
      // The recommended videos's first element should be the next video
      const video = videos[0]
      this.nextVideoUuid = video.uuid
      this.nextVideoTitle = video.name
    }
  }

  onModalOpened () {
    this.pausePlayer()
  }

  onVideoRemoved () {
    this.redirectService.redirectToHomepage()
  }

  declinedPrivacyConcern () {
    peertubeLocalStorage.setItem(VideoWatchComponent.LOCAL_STORAGE_PRIVACY_CONCERN_KEY, 'false')
    this.hasAlreadyAcceptedPrivacyConcern = false
  }

  acceptedPrivacyConcern () {
    peertubeLocalStorage.setItem(VideoWatchComponent.LOCAL_STORAGE_PRIVACY_CONCERN_KEY, 'true')
    this.hasAlreadyAcceptedPrivacyConcern = true
  }

  isVideoToTranscode () {
    return this.video && this.video.state.id === VideoState.TO_TRANSCODE
  }

  isVideoToImport () {
    return this.video && this.video.state.id === VideoState.TO_IMPORT
  }

  hasVideoScheduledPublication () {
    return this.video && this.video.scheduledUpdate !== undefined
  }

  isLive () {
    return !!(this.video?.isLive)
  }

  isWaitingForLive () {
    return this.video?.state.id === VideoState.WAITING_FOR_LIVE
  }

  isLiveEnded () {
    return this.video?.state.id === VideoState.LIVE_ENDED
  }

  isVideoBlur (video: Video) {
    return video.isVideoNSFWForUser(this.user, this.serverConfig)
  }

  isAutoPlayEnabled () {
    return (
      (this.user && this.user.autoPlayNextVideo) ||
      this.anonymousUser.autoPlayNextVideo
    )
  }

  handleTimestampClicked (timestamp: number) {
    if (!this.player || this.video.isLive) return

    this.player.currentTime(timestamp)
    scrollToTop()
  }

  isPlaylistAutoPlayEnabled () {
    return (
      (this.user && this.user.autoPlayNextVideoPlaylist) ||
      this.anonymousUser.autoPlayNextVideoPlaylist
    )
  }

  isChannelDisplayNameGeneric () {
    const genericChannelDisplayName = [
      `Main ${this.video.channel.ownerAccount.name} channel`,
      `Default ${this.video.channel.ownerAccount.name} channel`
    ]

    return genericChannelDisplayName.includes(this.video.channel.displayName)
  }

  onPlaylistVideoFound (videoId: string) {
    this.loadVideo(videoId)
  }

  private loadVideo (videoId: string) {
    // Video did not change
    if (this.video && this.video.uuid === videoId) return

    if (this.player) this.player.pause()

    const videoObs = this.hooks.wrapObsFun(
      this.videoService.getVideo.bind(this.videoService),
      { videoId },
      'video-watch',
      'filter:api.video-watch.video.get.params',
      'filter:api.video-watch.video.get.result'
    )

    // Video did change
    forkJoin([
      videoObs,
      this.videoCaptionService.listCaptions(videoId)
    ])
      .pipe(
        // If 400, 403 or 404, the video is private or blocked so redirect to 404
        catchError(err => {
          if (err.body.errorCode === ServerErrorCode.DOES_NOT_RESPECT_FOLLOW_CONSTRAINTS && err.body.originUrl) {
            const search = window.location.search
            let originUrl = err.body.originUrl
            if (search) originUrl += search

            this.confirmService.confirm(
              $localize`This video is not available on this instance. Do you want to be redirected on the origin instance: <a href="${originUrl}">${originUrl}</a>?`,
              $localize`Redirection`
            ).then(res => {
              if (res === false) {
                return this.restExtractor.redirectTo404IfNotFound(err, 'video', [
                  HttpStatusCode.BAD_REQUEST_400,
                  HttpStatusCode.FORBIDDEN_403,
                  HttpStatusCode.NOT_FOUND_404
                ])
              }

              return window.location.href = originUrl
            })
          }

          return this.restExtractor.redirectTo404IfNotFound(err, 'video', [
            HttpStatusCode.BAD_REQUEST_400,
            HttpStatusCode.FORBIDDEN_403,
            HttpStatusCode.NOT_FOUND_404
          ])
        })
      )
      .subscribe(([ video, captionsResult ]) => {
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
            .catch(err => this.handleError(err))
      })
  }

  private loadPlaylist (playlistId: string) {
    // Playlist did not change
    if (this.playlist && this.playlist.uuid === playlistId) return

    this.playlistService.getVideoPlaylist(playlistId)
      .pipe(
        // If 400 or 403, the video is private or blocked so redirect to 404
        catchError(err => this.restExtractor.redirectTo404IfNotFound(err, 'video', [
          HttpStatusCode.BAD_REQUEST_400,
          HttpStatusCode.FORBIDDEN_403,
          HttpStatusCode.NOT_FOUND_404
        ]))
      )
      .subscribe(playlist => {
        this.playlist = playlist

        this.videoWatchPlaylist.loadPlaylistElements(playlist, !this.playlistPosition, this.playlistPosition)
      })
  }

  private updateVideoDescription (description: string) {
    this.video.description = description
    this.setVideoDescriptionHTML()
      .catch(err => console.error(err))
  }

  private async setVideoDescriptionHTML () {
    const html = await this.markdownService.textMarkdownToHTML(this.video.description)
    this.videoHTMLDescription = await this.markdownService.processVideoTimestamps(html)
  }

  private setVideoLikesBarTooltipText () {
    this.likesBarTooltipText = `${this.video.likes} likes / ${this.video.dislikes} dislikes`
  }

  private handleError (err: any) {
    const errorMessage: string = typeof err === 'string' ? err : err.message
    if (!errorMessage) return

    // Display a message in the video player instead of a notification
    if (errorMessage.indexOf('from xs param') !== -1) {
      this.flushPlayer()
      this.remoteServerDown = true
      this.changeDetector.detectChanges()

      return
    }

    this.notifier.error(errorMessage)
  }

  private checkUserRating () {
    // Unlogged users do not have ratings
    if (this.isUserLoggedIn() === false) return

    this.videoService.getUserVideoRating(this.video.id)
        .subscribe(
          ratingObject => {
            if (ratingObject) {
              this.userRating = ratingObject.rating
            }
          },

          err => this.notifier.error(err.message)
        )
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
    this.descriptionLoading = false
    this.completeDescriptionShown = false
    this.remoteServerDown = false
    this.currentTime = undefined

    if (this.isVideoBlur(this.video)) {
      const res = await this.confirmService.confirm(
        $localize`This video contains mature or explicit content. Are you sure you want to watch it?`,
        $localize`Mature or explicit content`
      )
      if (res === false) return this.location.back()
    }

    const videoState = this.video.state.id
    if (videoState === VideoState.LIVE_ENDED || videoState === VideoState.WAITING_FOR_LIVE) return

    // Flush old player if needed
    this.flushPlayer()

    // Build video element, because videojs removes it on dispose
    const playerElementWrapper = this.elementRef.nativeElement.querySelector('#videojs-wrapper')
    this.playerElement = document.createElement('video')
    this.playerElement.className = 'video-js vjs-peertube-skin'
    this.playerElement.setAttribute('playsinline', 'true')
    playerElementWrapper.appendChild(this.playerElement)

    const params = {
      video: this.video,
      videoCaptions,
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

      this.player.on('customError', ({ err }: { err: any }) => this.handleError(err))

      this.player.on('timeupdate', () => {
        this.currentTime = Math.floor(this.player.currentTime())
      })

      /**
       * replaces this.player.one('ended')
       * 'condition()': true to make the upnext functionality trigger,
       *                false to disable the upnext functionality
       * go to the next video in 'condition()' if you don't want of the timer.
       * 'next': function triggered at the end of the timer.
       * 'suspended': function used at each clic of the timer checking if we need
       * to reset progress and wait until 'suspended' becomes truthy again.
       */
      this.player.upnext({
        timeout: 10000, // 10s
        headText: $localize`Up Next`,
        cancelText: $localize`Cancel`,
        suspendedText: $localize`Autoplay is suspended`,
        getTitle: () => this.nextVideoTitle,
        next: () => this.zone.run(() => this.autoplayNext()),
        condition: () => {
          if (this.playlist) {
            if (this.isPlaylistAutoPlayEnabled()) {
              // upnext will not trigger, and instead the next video will play immediately
              this.zone.run(() => this.videoWatchPlaylist.navigateToNextPlaylistVideo())
            }
          } else if (this.isAutoPlayEnabled()) {
            return true // upnext will trigger
          }
          return false // upnext will not trigger, and instead leave the video stopping
        },
        suspended: () => {
          return (
            !isXPercentInViewport(this.player.el(), 80) ||
            !document.getElementById('content').contains(document.activeElement)
          )
        }
      })

      this.player.one('stopped', () => {
        if (this.playlist) {
          if (this.isPlaylistAutoPlayEnabled()) this.zone.run(() => this.videoWatchPlaylist.navigateToNextPlaylistVideo())
        }
      })

      this.player.one('ended', () => {
        if (this.video.isLive) {
          this.video.state.id = VideoState.LIVE_ENDED
        }
      })

      this.player.on('theaterChange', (_: any, enabled: boolean) => {
        this.zone.run(() => this.theaterEnabled = enabled)
      })

      this.hooks.runAction('action:video-watch.player.loaded', 'video-watch', { player: this.player, videojs, video: this.video })
    })

    this.setVideoDescriptionHTML()
    this.setVideoLikesBarTooltipText()

    this.setOpenGraphTags()
    this.checkUserRating()

    this.hooks.runAction('action:video-watch.video.loaded', 'video-watch', { videojs })
  }

  private autoplayNext () {
    if (this.playlist) {
      this.zone.run(() => this.videoWatchPlaylist.navigateToNextPlaylistVideo())
    } else if (this.nextVideoUuid) {
      this.router.navigate([ '/videos/watch', this.nextVideoUuid ])
    }
  }

  private setRating (nextRating: UserVideoRateType) {
    const ratingMethods: { [id in UserVideoRateType]: (id: number) => Observable<any> } = {
      like: this.videoService.setVideoLike,
      dislike: this.videoService.setVideoDislike,
      none: this.videoService.unsetVideoLike
    }

    ratingMethods[nextRating].call(this.videoService, this.video.id)
          .subscribe(
            () => {
              // Update the video like attribute
              this.updateVideoRating(this.userRating, nextRating)
              this.userRating = nextRating
            },

            (err: { message: string }) => this.notifier.error(err.message)
          )
  }

  private updateVideoRating (oldRating: UserVideoRateType, newRating: UserVideoRateType) {
    let likesToIncrement = 0
    let dislikesToIncrement = 0

    if (oldRating) {
      if (oldRating === 'like') likesToIncrement--
      if (oldRating === 'dislike') dislikesToIncrement--
    }

    if (newRating === 'like') likesToIncrement++
    if (newRating === 'dislike') dislikesToIncrement++

    this.video.likes += likesToIncrement
    this.video.dislikes += dislikesToIncrement

    this.video.buildLikeAndDislikePercents()
    this.setVideoLikesBarTooltipText()
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

  private isAutoplay () {
    // We'll jump to the thread id, so do not play the video
    if (this.route.snapshot.params['threadId']) return false

    // Otherwise true by default
    if (!this.user) return true

    // Be sure the autoPlay is set to false
    return this.user.autoPlayVideo !== false
  }

  private flushPlayer () {
    // Remove player if it exists
    if (this.player) {
      try {
        this.player.dispose()
        this.player = undefined
      } catch (err) {
        console.error('Cannot dispose player.', err)
      }
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

      if (byUrl) return timeToInt(urlOptions.startTime)
      if (byHistory) return video.userHistory.currentTime

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
        nextVideo: () => this.zone.run(() => this.autoplayNext()),

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

        isLive: video.isLive,

        language: this.localeId,

        userWatching: user && user.videosHistoryEnabled === true ? {
          url: this.videoService.getUserWatchingVideoUrl(video.uuid),
          authorizationHeader: this.authService.getRequestHeaderValue()
        } : undefined,

        serverUrl: environment.apiUrl,

        videoCaptions: playerCaptions
      },

      webtorrent: {
        videoFiles: video.files
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

    // p2p-media-loader needs TextEncoder, try to fallback on WebTorrent
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

  private pausePlayer () {
    if (!this.player) return

    this.player.pause()
  }

  private resumePlayer () {
    if (!this.player) return

    this.player.play()
  }

  private isPlaying () {
    if (!this.player) return

    return !this.player.paused()
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

    // Reset to refetch the video
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
        new Hotkey('shift+l', () => {
          this.setLike()
          return false
        }, undefined, $localize`Like the video`),

        new Hotkey('shift+d', () => {
          this.setDislike()
          return false
        }, undefined, $localize`Dislike the video`),

        new Hotkey('shift+s', () => {
          this.subscribeButton.subscribed ? this.subscribeButton.unsubscribe() : this.subscribeButton.subscribe()
          return false
        }, undefined, $localize`Subscribe to the account`)
      ])
    }

    this.hotkeysService.add(this.hotkeys)
  }
}
