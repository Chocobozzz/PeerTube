import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { RedirectService } from '@app/core/routing/redirect.service'
import { peertubeLocalStorage } from '@app/shared/misc/peertube-local-storage'
import { VideoSupportComponent } from '@app/videos/+video-watch/modal/video-support.component'
import { MetaService } from '@ngx-meta/core'
import { NotificationsService } from 'angular2-notifications'
import { Subscription } from 'rxjs'
import * as videojs from 'video.js'
import 'videojs-hotkeys'
import * as WebTorrent from 'webtorrent'
import { UserVideoRateType, VideoRateType } from '../../../../../shared'
import '../../../assets/player/peertube-videojs-plugin'
import { AuthService, ConfirmService } from '../../core'
import { VideoBlacklistService } from '../../shared'
import { VideoDetails } from '../../shared/video/video-details.model'
import { Video } from '../../shared/video/video.model'
import { VideoService } from '../../shared/video/video.service'
import { MarkdownService } from '../shared'
import { VideoDownloadComponent } from './modal/video-download.component'
import { VideoReportComponent } from './modal/video-report.component'
import { VideoShareComponent } from './modal/video-share.component'
import { getVideojsOptions } from '../../../assets/player/peertube-player'
import { ServerService } from '@app/core'

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

  otherVideosDisplayed: Video[] = []

  player: videojs.Player
  playerElement: HTMLVideoElement
  userRating: UserVideoRateType = null
  video: VideoDetails = null
  videoNotFound = false
  descriptionLoading = false

  completeDescriptionShown = false
  completeVideoDescription: string
  shortVideoDescription: string
  videoHTMLDescription = ''
  likesBarTooltipText = ''
  hasAlreadyAcceptedPrivacyConcern = false

  private otherVideos: Video[] = []
  private paramsSub: Subscription

  constructor (
    private elementRef: ElementRef,
    private route: ActivatedRoute,
    private router: Router,
    private videoService: VideoService,
    private videoBlacklistService: VideoBlacklistService,
    private confirmService: ConfirmService,
    private metaService: MetaService,
    private authService: AuthService,
    private serverService: ServerService,
    private notificationsService: NotificationsService,
    private markdownService: MarkdownService,
    private zone: NgZone,
    private redirectService: RedirectService
  ) {}

  get user () {
    return this.authService.getUser()
  }

  ngOnInit () {
    if (
      WebTorrent.WEBRTC_SUPPORT === false ||
      peertubeLocalStorage.getItem(VideoWatchComponent.LOCAL_STORAGE_PRIVACY_CONCERN_KEY) === 'true'
    ) {
      this.hasAlreadyAcceptedPrivacyConcern = true
    }

    this.videoService.getVideos({ currentPage: 1, itemsPerPage: 5 }, '-createdAt')
      .subscribe(
        data => {
          this.otherVideos = data.videos
          this.updateOtherVideosDisplayed()
        },

        err => console.error(err)
      )

    this.paramsSub = this.route.params.subscribe(routeParams => {
      if (this.player) {
        this.player.pause()
      }

      const uuid = routeParams['uuid']
      // Video did not change
      if (this.video && this.video.uuid === uuid) return
      // Video did change
      this.videoService.getVideo(uuid).subscribe(
        video => {
          const startTime = this.route.snapshot.queryParams.start
          this.onVideoFetched(video, startTime)
            .catch(err => this.handleError(err))
        },

        error => {
          this.videoNotFound = true
          console.error(error)
        }
      )
    })
  }

  ngOnDestroy () {
    this.flushPlayer()

    // Unsubscribe subscriptions
    this.paramsSub.unsubscribe()
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

  async blacklistVideo (event: Event) {
    event.preventDefault()

    const res = await this.confirmService.confirm('Do you really want to blacklist this video?', 'Blacklist')
    if (res === false) return

    this.videoBlacklistService.blacklistVideo(this.video.id)
                              .subscribe(
                                status => {
                                  this.notificationsService.success('Success', `Video ${this.video.name} had been blacklisted.`)
                                  this.redirectService.redirectToHomepage()
                                },

                                error => this.notificationsService.error('Error', error.message)
                              )
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
          this.notificationsService.error('Error', error.message)
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
    this.videoShareModal.show()
  }

  showDownloadModal (event: Event) {
    event.preventDefault()
    this.videoDownloadModal.show()
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

  getVideoPoster () {
    if (!this.video) return ''

    return this.video.previewUrl
  }

  getVideoTags () {
    if (!this.video || Array.isArray(this.video.tags) === false) return []

    return this.video.tags.join(', ')
  }

  isVideoRemovable () {
    return this.video.isRemovableBy(this.authService.getUser())
  }

  async removeVideo (event: Event) {
    event.preventDefault()

    const res = await this.confirmService.confirm('Do you really want to delete this video?', 'Delete')
    if (res === false) return

    this.videoService.removeVideo(this.video.id)
      .subscribe(
        status => {
          this.notificationsService.success('Success', `Video ${this.video.name} deleted.`)

          // Go back to the video-list.
          this.redirectService.redirectToHomepage()
        },

        error => this.notificationsService.error('Error', error.message)
      )
  }

  acceptedPrivacyConcern () {
    peertubeLocalStorage.setItem(VideoWatchComponent.LOCAL_STORAGE_PRIVACY_CONCERN_KEY, 'true')
    this.hasAlreadyAcceptedPrivacyConcern = true
  }

  private updateVideoDescription (description: string) {
    this.video.description = description
    this.setVideoDescriptionHTML()
  }

  private setVideoDescriptionHTML () {
    if (!this.video.description) {
      this.videoHTMLDescription = ''
      return
    }

    this.videoHTMLDescription = this.markdownService.textMarkdownToHTML(this.video.description)
  }

  private setVideoLikesBarTooltipText () {
    this.likesBarTooltipText = `${this.video.likes} likes / ${this.video.dislikes} dislikes`
  }

  private handleError (err: any) {
    const errorMessage: string = typeof err === 'string' ? err : err.message
    if (!errorMessage) return

    let message = ''

    if (errorMessage.indexOf('http error') !== -1) {
      message = 'Cannot fetch video from server, maybe down.'
    } else {
      message = errorMessage
    }

    this.notificationsService.error('Error', message)
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

                       err => this.notificationsService.error('Error', err.message)
                      )
  }

  private async onVideoFetched (video: VideoDetails, startTime = 0) {
    this.video = video

    // Re init attributes
    this.descriptionLoading = false
    this.completeDescriptionShown = false

    this.updateOtherVideosDisplayed()

    if (this.video.isVideoNSFWForUser(this.user, this.serverService.getConfig())) {
      const res = await this.confirmService.confirm(
        'This video contains mature or explicit content. Are you sure you want to watch it?',
        'Mature or explicit content'
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

    const videojsOptions = getVideojsOptions({
      autoplay: this.isAutoplay(),
      inactivityTimeout: 2500,
      videoFiles: this.video.files,
      playerElement: this.playerElement,
      videoViewUrl: this.videoService.getVideoViewUrl(this.video.uuid),
      videoDuration: this.video.duration,
      enableHotkeys: true,
      peertubeLink: false,
      poster: this.video.previewUrl,
      startTime
    })

    const self = this
    this.zone.runOutsideAngular(() => {
      videojs(this.playerElement, videojsOptions, function () {
        self.player = this
        this.on('customError', (event, data) => self.handleError(data.err))
      })
    })

    this.setVideoDescriptionHTML()
    this.setVideoLikesBarTooltipText()

    this.setOpenGraphTags()
    this.checkUserRating()
  }

  private setRating (nextRating) {
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
      err => this.notificationsService.error('Error', err.message)
     )
  }

  private updateVideoRating (oldRating: UserVideoRateType, newRating: VideoRateType) {
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

  private updateOtherVideosDisplayed () {
    if (this.video && this.otherVideos && this.otherVideos.length > 0) {
      this.otherVideosDisplayed = this.otherVideos.filter(v => v.uuid !== this.video.uuid)
    }
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
    // True by default
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
