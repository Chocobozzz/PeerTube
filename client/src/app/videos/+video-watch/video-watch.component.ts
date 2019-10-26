import { catchError } from 'rxjs/operators'
import { ChangeDetectorRef, Component, ElementRef, Inject, LOCALE_ID, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { RedirectService } from '@app/core/routing/redirect.service'
import { peertubeLocalStorage } from '@app/shared/misc/peertube-local-storage'
import { VideoSupportComponent } from '@app/videos/+video-watch/modal/video-support.component'
import { MetaService } from '@ngx-meta/core'
import { Notifier, ServerService } from '@app/core'
import { forkJoin, Observable, Subscription } from 'rxjs'
import { Hotkey, HotkeysService } from 'angular2-hotkeys'
import { UserVideoRateType, VideoCaption, VideoPrivacy, VideoState } from '../../../../../shared'
import { AuthService, ConfirmService } from '../../core'
import { RestExtractor, VideoBlacklistService } from '../../shared'
import { VideoDetails } from '../../shared/video/video-details.model'
import { VideoService } from '../../shared/video/video.service'
import { VideoShareComponent } from './modal/video-share.component'
import { SubscribeButtonComponent } from '@app/shared/user-subscription/subscribe-button.component'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { environment } from '../../../environments/environment'
import { VideoCaptionService } from '@app/shared/video-caption'
import { MarkdownService } from '@app/shared/renderer'
import {
  CustomizationOptions,
  P2PMediaLoaderOptions,
  PeertubePlayerManager,
  PeertubePlayerManagerOptions,
  PlayerMode
} from '../../../assets/player/peertube-player-manager'
import { VideoPlaylist } from '@app/shared/video-playlist/video-playlist.model'
import { VideoPlaylistService } from '@app/shared/video-playlist/video-playlist.service'
import { Video } from '@app/shared/video/video.model'
import { isWebRTCDisabled, timeToInt } from '../../../assets/player/utils'
import { VideoWatchPlaylistComponent } from '@app/videos/+video-watch/video-watch-playlist.component'
import { getStoredTheater } from '../../../assets/player/peertube-player-local-storage'
import { PluginService } from '@app/core/plugins/plugin.service'
import { HooksService } from '@app/core/plugins/hooks.service'
import { PlatformLocation } from '@angular/common'
import { randomInt } from '@shared/core-utils/miscs/miscs'

@Component({
  selector: 'my-video-watch',
  templateUrl: './video-watch.component.html',
  styleUrls: [ './video-watch.component.scss' ]
})
export class VideoWatchComponent implements OnInit, OnDestroy {
  private static LOCAL_STORAGE_PRIVACY_CONCERN_KEY = 'video-watch-privacy-concern'

  @ViewChild('videoWatchPlaylist', { static: true }) videoWatchPlaylist: VideoWatchPlaylistComponent
  @ViewChild('videoShareModal', { static: false }) videoShareModal: VideoShareComponent
  @ViewChild('videoSupportModal', { static: false }) videoSupportModal: VideoSupportComponent
  @ViewChild('subscribeButton', { static: false }) subscribeButton: SubscribeButtonComponent

  player: any
  playerElement: HTMLVideoElement
  theaterEnabled = false
  userRating: UserVideoRateType = null
  descriptionLoading = false

  video: VideoDetails = null
  videoCaptions: VideoCaption[] = []

  playlist: VideoPlaylist = null

  completeDescriptionShown = false
  completeVideoDescription: string
  shortVideoDescription: string
  videoHTMLDescription = ''
  likesBarTooltipText = ''
  hasAlreadyAcceptedPrivacyConcern = false
  remoteServerDown = false
  hotkeys: Hotkey[]

  private nextVideoUuid = ''
  private currentTime: number
  private paramsSub: Subscription
  private queryParamsSub: Subscription
  private configSub: Subscription

  constructor (
    private elementRef: ElementRef,
    private changeDetector: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private videoService: VideoService,
    private playlistService: VideoPlaylistService,
    private videoBlacklistService: VideoBlacklistService,
    private confirmService: ConfirmService,
    private metaService: MetaService,
    private authService: AuthService,
    private serverService: ServerService,
    private restExtractor: RestExtractor,
    private notifier: Notifier,
    private pluginService: PluginService,
    private markdownService: MarkdownService,
    private zone: NgZone,
    private redirectService: RedirectService,
    private videoCaptionService: VideoCaptionService,
    private i18n: I18n,
    private hotkeysService: HotkeysService,
    private hooks: HooksService,
    private location: PlatformLocation,
    @Inject(LOCALE_ID) private localeId: string
  ) {}

  get user () {
    return this.authService.getUser()
  }

  async ngOnInit () {
    this.configSub = this.serverService.configLoaded
        .subscribe(() => {
          if (
            isWebRTCDisabled() ||
            this.serverService.getConfig().tracker.enabled === false ||
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
      const videoId = queryParams[ 'videoId' ]
      if (videoId) this.loadVideo(videoId)
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

    // Unbind hotkeys
    if (this.isUserLoggedIn()) this.hotkeysService.remove(this.hotkeys)
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
    this.videoSupportModal.show()
  }

  showShareModal () {
    this.videoShareModal.show(this.currentTime)
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
      // Pick a random video until the recommendations are improved
      this.nextVideoUuid = videos[randomInt(0,videos.length - 1)].uuid
    }
  }

  onVideoRemoved () {
    this.redirectService.redirectToHomepage()
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

  isVideoBlur (video: Video) {
    return video.isVideoNSFWForUser(this.user, this.serverService.getConfig())
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
        // If 401, the video is private or blacklisted so redirect to 404
        catchError(err => this.restExtractor.redirectTo404IfNotFound(err, [ 400, 401, 403, 404 ]))
      )
      .subscribe(([ video, captionsResult ]) => {
        const queryParams = this.route.snapshot.queryParams

        const urlOptions = {
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
        // If 401, the video is private or blacklisted so redirect to 404
        catchError(err => this.restExtractor.redirectTo404IfNotFound(err, [ 400, 401, 403, 404 ]))
      )
      .subscribe(playlist => {
        this.playlist = playlist

        const videoId = this.route.snapshot.queryParams['videoId']
        this.videoWatchPlaylist.loadPlaylistElements(playlist, !videoId)
      })
  }

  private updateVideoDescription (description: string) {
    this.video.description = description
    this.setVideoDescriptionHTML()
      .catch(err => console.error(err))
  }

  private async setVideoDescriptionHTML () {
    this.videoHTMLDescription = await this.markdownService.textMarkdownToHTML(this.video.description)
  }

  private setVideoLikesBarTooltipText () {
    this.likesBarTooltipText = this.i18n('{{likesNumber}} likes / {{dislikesNumber}} dislikes', {
      likesNumber: this.video.likes,
      dislikesNumber: this.video.dislikes
    })
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
    urlOptions: CustomizationOptions & { playerMode: PlayerMode }
  ) {
    this.video = video
    this.videoCaptions = videoCaptions

    // Re init attributes
    this.descriptionLoading = false
    this.completeDescriptionShown = false
    this.remoteServerDown = false
    this.currentTime = undefined

    this.videoWatchPlaylist.updatePlaylistIndex(video)

    let startTime = timeToInt(urlOptions.startTime) || (this.video.userHistory ? this.video.userHistory.currentTime : 0)
    // If we are at the end of the video, reset the timer
    if (this.video.duration - startTime <= 1) startTime = 0

    if (this.isVideoBlur(this.video)) {
      const res = await this.confirmService.confirm(
        this.i18n('This video contains mature or explicit content. Are you sure you want to watch it?'),
        this.i18n('Mature or explicit content')
      )
      if (res === false) return this.location.back()
    }

    // Flush old player if needed
    this.flushPlayer()

    // Build video element, because videojs removes it on dispose
    const playerElementWrapper = this.elementRef.nativeElement.querySelector('#videojs-wrapper')
    this.playerElement = document.createElement('video')
    this.playerElement.className = 'video-js vjs-peertube-skin'
    this.playerElement.setAttribute('playsinline', 'true')
    playerElementWrapper.appendChild(this.playerElement)

    const playerCaptions = videoCaptions.map(c => ({
      label: c.language.label,
      language: c.language.id,
      src: environment.apiUrl + c.captionPath
    }))

    const options: PeertubePlayerManagerOptions = {
      common: {
        autoplay: this.isAutoplay(),

        playerElement: this.playerElement,
        onPlayerElementChange: (element: HTMLVideoElement) => this.playerElement = element,

        videoDuration: this.video.duration,
        enableHotkeys: true,
        inactivityTimeout: 2500,
        poster: this.video.previewUrl,

        startTime,
        stopTime: urlOptions.stopTime,
        controls: urlOptions.controls,
        muted: urlOptions.muted,
        loop: urlOptions.loop,
        subtitle: urlOptions.subtitle,

        peertubeLink: urlOptions.peertubeLink,

        theaterMode: true,
        captions: videoCaptions.length !== 0,

        videoViewUrl: this.video.privacy.id !== VideoPrivacy.PRIVATE
          ? this.videoService.getVideoViewUrl(this.video.uuid)
          : null,
        embedUrl: this.video.embedUrl,

        language: this.localeId,

        userWatching: this.user && this.user.videosHistoryEnabled === true ? {
          url: this.videoService.getUserWatchingVideoUrl(this.video.uuid),
          authorizationHeader: this.authService.getRequestHeaderValue()
        } : undefined,

        serverUrl: environment.apiUrl,

        videoCaptions: playerCaptions
      },

      webtorrent: {
        videoFiles: this.video.files
      }
    }

    let mode: PlayerMode

    if (urlOptions.playerMode) {
      if (urlOptions.playerMode === 'p2p-media-loader') mode = 'p2p-media-loader'
      else mode = 'webtorrent'
    } else {
      if (this.video.hasHlsPlaylist()) mode = 'p2p-media-loader'
      else mode = 'webtorrent'
    }

    if (mode === 'p2p-media-loader') {
      const hlsPlaylist = this.video.getHlsPlaylist()

      const p2pMediaLoader = {
        playlistUrl: hlsPlaylist.playlistUrl,
        segmentsSha256Url: hlsPlaylist.segmentsSha256Url,
        redundancyBaseUrls: hlsPlaylist.redundancies.map(r => r.baseUrl),
        trackerAnnounce: this.video.trackerUrls,
        videoFiles: this.video.files
      } as P2PMediaLoaderOptions

      Object.assign(options, { p2pMediaLoader })
    }

    this.zone.runOutsideAngular(async () => {
      this.player = await PeertubePlayerManager.initialize(mode, options, player => this.player = player)

      this.player.on('customError', ({ err }: { err: any }) => this.handleError(err))

      this.player.on('timeupdate', () => {
        this.currentTime = Math.floor(this.player.currentTime())
      })

      this.player.one('ended', () => {
        if (this.playlist) {
          this.zone.run(() => this.videoWatchPlaylist.navigateToNextPlaylistVideo())
        } else if (this.user && this.user.autoPlayNextVideo) {
          this.zone.run(() => this.autoplayNext())
        }
      })

      this.player.one('stopped', () => {
        if (this.playlist) {
          this.zone.run(() => this.videoWatchPlaylist.navigateToNextPlaylistVideo())
        }
      })

      this.player.on('theaterChange', (_: any, enabled: boolean) => {
        this.zone.run(() => this.theaterEnabled = enabled)
      })
    })

    this.setVideoDescriptionHTML()
    this.setVideoLikesBarTooltipText()

    this.setOpenGraphTags()
    this.checkUserRating()

    this.hooks.runAction('action:video-watch.video.loaded', 'video-watch')
  }

  private autoplayNext () {
    if (this.nextVideoUuid) {
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

  private initHotkeys () {
    this.hotkeys = [
      new Hotkey('shift+l', () => {
        this.setLike()
        return false
      }, undefined, this.i18n('Like the video')),

      new Hotkey('shift+d', () => {
        this.setDislike()
        return false
      }, undefined, this.i18n('Dislike the video')),

      new Hotkey('shift+s', () => {
        this.subscribeButton.subscribed ? this.subscribeButton.unsubscribe() : this.subscribeButton.subscribe()
        return false
      }, undefined, this.i18n('Subscribe to the account'))
    ]
    if (this.isUserLoggedIn()) this.hotkeysService.add(this.hotkeys)
  }
}
