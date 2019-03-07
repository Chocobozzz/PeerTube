import { catchError } from 'rxjs/operators'
import { ChangeDetectorRef, Component, ElementRef, Inject, LOCALE_ID, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { RedirectService } from '@app/core/routing/redirect.service'
import { peertubeLocalStorage } from '@app/shared/misc/peertube-local-storage'
import { VideoSupportComponent } from '@app/videos/+video-watch/modal/video-support.component'
import { MetaService } from '@ngx-meta/core'
import { Notifier, ServerService } from '@app/core'
import { forkJoin, Subscription } from 'rxjs'
import { Hotkey, HotkeysService } from 'angular2-hotkeys'
import { UserVideoRateType, VideoCaption, VideoPrivacy, VideoState } from '../../../../../shared'
import { AuthService, ConfirmService } from '../../core'
import { RestExtractor, VideoBlacklistService } from '../../shared'
import { VideoDetails } from '../../shared/video/video-details.model'
import { VideoService } from '../../shared/video/video.service'
import { VideoDownloadComponent } from './modal/video-download.component'
import { VideoReportComponent } from './modal/video-report.component'
import { VideoShareComponent } from './modal/video-share.component'
import { VideoBlacklistComponent } from './modal/video-blacklist.component'
import { SubscribeButtonComponent } from '@app/shared/user-subscription/subscribe-button.component'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { environment } from '../../../environments/environment'
import { VideoCaptionService } from '@app/shared/video-caption'
import { MarkdownService } from '@app/shared/renderer'
import {
  P2PMediaLoaderOptions,
  PeertubePlayerManager,
  PeertubePlayerManagerOptions,
  PlayerMode
} from '../../../assets/player/peertube-player-manager'

@Component({
  selector: 'my-video-watch',
  templateUrl: './video-watch.component.html',
  styleUrls: [ './video-watch.component.scss' ]
})
export class VideoWatchComponent implements OnInit, OnDestroy {
  private static LOCAL_STORAGE_PRIVACY_CONCERN_KEY = 'video-watch-privacy-concern'

  @ViewChild('videoDownloadModal') videoDownloadModal: VideoDownloadComponent
  @ViewChild('videoShareModal') videoShareModal: VideoShareComponent
  @ViewChild('videoReportModal') videoReportModal: VideoReportComponent
  @ViewChild('videoSupportModal') videoSupportModal: VideoSupportComponent
  @ViewChild('videoBlacklistModal') videoBlacklistModal: VideoBlacklistComponent
  @ViewChild('subscribeButton') subscribeButton: SubscribeButtonComponent

  player: any
  playerElement: HTMLVideoElement
  userRating: UserVideoRateType = null
  video: VideoDetails = null
  descriptionLoading = false

  completeDescriptionShown = false
  completeVideoDescription: string
  shortVideoDescription: string
  videoHTMLDescription = ''
  likesBarTooltipText = ''
  hasAlreadyAcceptedPrivacyConcern = false
  remoteServerDown = false
  hotkeys: Hotkey[]

  private currentTime: number
  private paramsSub: Subscription

  constructor (
    private elementRef: ElementRef,
    private changeDetector: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private videoService: VideoService,
    private videoBlacklistService: VideoBlacklistService,
    private confirmService: ConfirmService,
    private metaService: MetaService,
    private authService: AuthService,
    private serverService: ServerService,
    private restExtractor: RestExtractor,
    private notifier: Notifier,
    private markdownService: MarkdownService,
    private zone: NgZone,
    private redirectService: RedirectService,
    private videoCaptionService: VideoCaptionService,
    private i18n: I18n,
    private hotkeysService: HotkeysService,
    @Inject(LOCALE_ID) private localeId: string
  ) {}

  get user () {
    return this.authService.getUser()
  }

  ngOnInit () {
    if (
      !!((window as any).RTCPeerConnection || (window as any).mozRTCPeerConnection || (window as any).webkitRTCPeerConnection) === false ||
      peertubeLocalStorage.getItem(VideoWatchComponent.LOCAL_STORAGE_PRIVACY_CONCERN_KEY) === 'true'
    ) {
      this.hasAlreadyAcceptedPrivacyConcern = true
    }

    this.paramsSub = this.route.params.subscribe(routeParams => {
      const uuid = routeParams[ 'uuid' ]

      // Video did not change
      if (this.video && this.video.uuid === uuid) return

      if (this.player) this.player.pause()

      // Video did change
      forkJoin(
        this.videoService.getVideo(uuid),
        this.videoCaptionService.listCaptions(uuid)
      )
        .pipe(
          // If 401, the video is private or blacklisted so redirect to 404
          catchError(err => this.restExtractor.redirectTo404IfNotFound(err, [ 400, 401, 403, 404 ]))
        )
        .subscribe(([ video, captionsResult ]) => {
          const startTime = this.route.snapshot.queryParams.start
          const stopTime = this.route.snapshot.queryParams.stop
          const subtitle = this.route.snapshot.queryParams.subtitle
          const playerMode = this.route.snapshot.queryParams.mode

          this.onVideoFetched(video, captionsResult.data, { startTime, stopTime, subtitle, playerMode })
              .catch(err => this.handleError(err))
        })
    })

    this.hotkeys = [
      new Hotkey('shift+l', (event: KeyboardEvent): boolean => {
        this.setLike()
        return false
      }, undefined, this.i18n('Like the video')),
      new Hotkey('shift+d', (event: KeyboardEvent): boolean => {
        this.setDislike()
        return false
      }, undefined, this.i18n('Dislike the video')),
      new Hotkey('shift+s', (event: KeyboardEvent): boolean => {
        this.subscribeButton.subscribed ?
          this.subscribeButton.unsubscribe() :
          this.subscribeButton.subscribe()
        return false
      }, undefined, this.i18n('Subscribe to the account'))
    ]
    if (this.isUserLoggedIn()) this.hotkeysService.add(this.hotkeys)
  }

  ngOnDestroy () {
    this.flushPlayer()

    // Unsubscribe subscriptions
    this.paramsSub.unsubscribe()

    // Unbind hotkeys
    if (this.isUserLoggedIn()) this.hotkeysService.remove(this.hotkeys)
  }

  setLike () {
    if (this.isUserLoggedIn() === false) return
    if (this.userRating === 'like') {
      // Already liked this video
      this.setRating('none')
    } else {
      this.setRating('like')
    }
  }

  setDislike () {
    if (this.isUserLoggedIn() === false) return
    if (this.userRating === 'dislike') {
      // Already disliked this video
      this.setRating('none')
    } else {
      this.setRating('dislike')
    }
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

  showReportModal (event: Event) {
    event.preventDefault()
    this.videoReportModal.show()
  }

  showSupportModal () {
    this.videoSupportModal.show()
  }

  showShareModal () {
    const currentTime = this.player ? this.player.currentTime() : undefined

    this.videoShareModal.show(this.currentTime)
  }

  showDownloadModal (event: Event) {
    event.preventDefault()
    this.videoDownloadModal.show()
  }

  showBlacklistModal (event: Event) {
    event.preventDefault()
    this.videoBlacklistModal.show()
  }

  async unblacklistVideo (event: Event) {
    event.preventDefault()

    const confirmMessage = this.i18n(
      'Do you really want to remove this video from the blacklist? It will be available again in the videos list.'
    )

    const res = await this.confirmService.confirm(confirmMessage, this.i18n('Unblacklist'))
    if (res === false) return

    this.videoBlacklistService.removeVideoFromBlacklist(this.video.id).subscribe(
      () => {
        this.notifier.success(this.i18n('Video {{name}} removed from the blacklist.', { name: this.video.name }))

        this.video.blacklisted = false
        this.video.blacklistedReason = null
      },

      err => this.notifier.error(err.message)
    )
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  isVideoUpdatable () {
    return this.video.isUpdatableBy(this.authService.getUser())
  }

  isVideoBlacklistable () {
    return this.video.isBlackistableBy(this.user)
  }

  isVideoUnblacklistable () {
    return this.video.isUnblacklistableBy(this.user)
  }

  getVideoTags () {
    if (!this.video || Array.isArray(this.video.tags) === false) return []

    return this.video.tags
  }

  isVideoRemovable () {
    return this.video.isRemovableBy(this.authService.getUser())
  }

  async removeVideo (event: Event) {
    event.preventDefault()

    const res = await this.confirmService.confirm(this.i18n('Do you really want to delete this video?'), this.i18n('Delete'))
    if (res === false) return

    this.videoService.removeVideo(this.video.id)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Video {{videoName}} deleted.', { videoName: this.video.name }))

            // Go back to the video-list.
            this.redirectService.redirectToHomepage()
          },

          error => this.notifier.error(error.message)
        )
  }

  acceptedPrivacyConcern () {
    peertubeLocalStorage.setItem(VideoWatchComponent.LOCAL_STORAGE_PRIVACY_CONCERN_KEY, 'true')
    this.hasAlreadyAcceptedPrivacyConcern = true
  }

  isVideoToTranscode () {
    return this.video && this.video.state.id === VideoState.TO_TRANSCODE
  }

  isVideoDownloadable () {
    return this.video && this.video.downloadEnabled
  }

  isVideoToImport () {
    return this.video && this.video.state.id === VideoState.TO_IMPORT
  }

  hasVideoScheduledPublication () {
    return this.video && this.video.scheduledUpdate !== undefined
  }

  private updateVideoDescription (description: string) {
    this.video.description = description
    this.setVideoDescriptionHTML()
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
    urlOptions: { startTime?: number, stopTime?: number, subtitle?: string, playerMode?: string }
  ) {
    this.video = video

    // Re init attributes
    this.descriptionLoading = false
    this.completeDescriptionShown = false
    this.remoteServerDown = false
    this.currentTime = undefined

    let startTime = urlOptions.startTime || (this.video.userHistory ? this.video.userHistory.currentTime : 0)
    // If we are at the end of the video, reset the timer
    if (this.video.duration - startTime <= 1) startTime = 0

    if (this.video.isVideoNSFWForUser(this.user, this.serverService.getConfig())) {
      const res = await this.confirmService.confirm(
        this.i18n('This video contains mature or explicit content. Are you sure you want to watch it?'),
        this.i18n('Mature or explicit content')
      )
      if (res === false) return this.redirectService.redirectToHomepage()
    }

    // Flush old player if needed
    this.flushPlayer()

    // Build video element, because videojs remove it on dispose
    const playerElementWrapper = this.elementRef.nativeElement.querySelector('#video-element-wrapper')
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

        theaterMode: true,
        captions: videoCaptions.length !== 0,
        peertubeLink: false,

        videoViewUrl: this.video.privacy.id !== VideoPrivacy.PRIVATE ? this.videoService.getVideoViewUrl(this.video.uuid) : null,
        embedUrl: this.video.embedUrl,

        language: this.localeId,

        subtitle: urlOptions.subtitle,

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

    const mode: PlayerMode = urlOptions.playerMode === 'p2p-media-loader' ? 'p2p-media-loader' : 'webtorrent'

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
      this.player = await PeertubePlayerManager.initialize(mode, options)
      this.player.on('customError', ({ err }: { err: any }) => this.handleError(err))

      this.player.on('timeupdate', () => {
        this.currentTime = Math.floor(this.player.currentTime())
      })
    })

    this.setVideoDescriptionHTML()
    this.setVideoLikesBarTooltipText()

    this.setOpenGraphTags()
    this.checkUserRating()
  }

  private setRating (nextRating: UserVideoRateType) {
    let method
    switch (nextRating) {
      case 'like':
        method = this.videoService.setVideoLike
        break
      case 'dislike':
        method = this.videoService.setVideoDislike
        break
      case 'none':
        method = this.videoService.unsetVideoLike
        break
    }

    method.call(this.videoService, this.video.id)
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
      this.player.dispose()
      this.player = undefined
    }
  }
}
