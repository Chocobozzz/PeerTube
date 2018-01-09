import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { MetaService } from '@ngx-meta/core'
import { NotificationsService } from 'angular2-notifications'
import { Observable } from 'rxjs/Observable'
import { Subscription } from 'rxjs/Subscription'
import * as videojs from 'video.js'
import { UserVideoRateType, VideoRateType } from '../../../../../shared'
import '../../../assets/player/peertube-videojs-plugin'
import { AuthService, ConfirmService } from '../../core'
import { VideoBlacklistService } from '../../shared'
import { Account } from '../../shared/account/account.model'
import { VideoDetails } from '../../shared/video/video-details.model'
import { Video } from '../../shared/video/video.model'
import { VideoService } from '../../shared/video/video.service'
import { MarkdownService } from '../shared'
import { VideoDownloadComponent } from './modal/video-download.component'
import { VideoReportComponent } from './modal/video-report.component'
import { VideoShareComponent } from './modal/video-share.component'

@Component({
  selector: 'my-video-watch',
  templateUrl: './video-watch.component.html',
  styleUrls: [ './video-watch.component.scss' ]
})
export class VideoWatchComponent implements OnInit, OnDestroy {
  @ViewChild('videoDownloadModal') videoDownloadModal: VideoDownloadComponent
  @ViewChild('videoShareModal') videoShareModal: VideoShareComponent
  @ViewChild('videoReportModal') videoReportModal: VideoReportComponent

  otherVideosDisplayed: Video[] = []

  error = false
  loading = false
  player: videojs.Player
  playerElement: HTMLVideoElement
  userRating: UserVideoRateType = null
  video: VideoDetails = null
  videoPlayerLoaded = false
  videoNotFound = false
  descriptionLoading = false

  completeDescriptionShown = false
  completeVideoDescription: string
  shortVideoDescription: string
  videoHTMLDescription = ''
  likesBarTooltipText = ''

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
    private notificationsService: NotificationsService,
    private markdownService: MarkdownService
  ) {}

  get user () {
    return this.authService.getUser()
  }

  ngOnInit () {
    this.videoService.getVideos({ currentPage: 1, itemsPerPage: 5 }, '-createdAt')
      .subscribe(
        data => this.otherVideos = data.videos,
        err => console.error(err)
      )

    this.paramsSub = this.route.params.subscribe(routeParams => {
      if (this.videoPlayerLoaded) {
        this.player.pause()
      }

      let uuid = routeParams['uuid']
      this.videoService.getVideo(uuid).subscribe(
        video => this.onVideoFetched(video),

        error => {
          this.videoNotFound = true
          console.error(error)
        }
      )
    })
  }

  ngOnDestroy () {
    // Remove player if it exists
    if (this.videoPlayerLoaded === true) {
      videojs(this.playerElement).dispose()
    }

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

  blacklistVideo (event: Event) {
    event.preventDefault()

    this.confirmService.confirm('Do you really want to blacklist this video?', 'Blacklist').subscribe(
      res => {
        if (res === false) return

        this.videoBlacklistService.blacklistVideo(this.video.id)
                                  .subscribe(
                                    status => {
                                      this.notificationsService.success('Success', `Video ${this.video.name} had been blacklisted.`)
                                      this.router.navigate(['/videos/list'])
                                    },

                                    error => this.notificationsService.error('Error', error.message)
                                  )
      }
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

  getAvatarPath () {
    return Account.GET_ACCOUNT_AVATAR_URL(this.video.account)
  }

  getVideoTags () {
    if (!this.video || Array.isArray(this.video.tags) === false) return []

    return this.video.tags.join(', ')
  }

  isVideoRemovable () {
    return this.video.isRemovableBy(this.authService.getUser())
  }

  removeVideo (event: Event) {
    event.preventDefault()

    this.confirmService.confirm('Do you really want to delete this video?', 'Delete')
      .subscribe(
        res => {
          if (res === false) return

          this.videoService.removeVideo(this.video.id)
            .subscribe(
              status => {
                this.notificationsService.success('Success', `Video ${this.video.name} deleted.`)

                // Go back to the video-list.
                this.router.navigate([ '/videos/list' ])
              },

              error => this.notificationsService.error('Error', error.message)
            )
        }
      )
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

    this.videoHTMLDescription = this.markdownService.markdownToHTML(this.video.description)
  }

  private setVideoLikesBarTooltipText () {
    this.likesBarTooltipText = `${this.video.likes} likes / ${this.video.dislikes} dislikes`
  }

  private handleError (err: any) {
    const errorMessage: string = typeof err === 'string' ? err : err.message
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

  private onVideoFetched (video: VideoDetails) {
    this.video = video

    if (this.otherVideos.length > 0) {
      this.otherVideosDisplayed = this.otherVideos.filter(v => v.uuid !== this.video.uuid)
    }

    let observable
    if (this.video.isVideoNSFWForUser(this.user)) {
      observable = this.confirmService.confirm(
        'This video contains mature or explicit content. Are you sure you want to watch it?',
        'Mature or explicit content'
      )
    } else {
      observable = Observable.of(true)
    }

    observable.subscribe(
      res => {
        if (res === false) {

          return this.router.navigate([ '/videos/list' ])
        }

        // Player was already loaded
        if (this.videoPlayerLoaded !== true) {
          this.playerElement = this.elementRef.nativeElement.querySelector('#video-element')

          // If autoplay is true, we don't really need a poster
          if (this.isAutoplay() === false) {
            this.playerElement.poster = this.video.previewUrl
          }

          const videojsOptions = {
            controls: true,
            autoplay: this.isAutoplay(),
            plugins: {
              peertube: {
                videoFiles: this.video.files,
                playerElement: this.playerElement,
                peerTubeLink: false
              }
            }
          }

          this.videoPlayerLoaded = true

          const self = this
          videojs(this.playerElement, videojsOptions, function () {
            self.player = this
            this.on('customError', (event, data) => {
              self.handleError(data.err)
            })
          })
        } else {
          (this.player as any).setVideoFiles(this.video.files)
        }

        this.setVideoDescriptionHTML()
        this.setVideoLikesBarTooltipText()

        this.setOpenGraphTags()
        this.checkUserRating()

        this.prepareViewAdd()
      }
    )
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

  private prepareViewAdd () {
    // After 30 seconds (or 3/4 of the video), increment add a view
    let viewTimeoutSeconds = 30
    if (this.video.duration < viewTimeoutSeconds) viewTimeoutSeconds = (this.video.duration * 3) / 4

    setTimeout(() => {
      this.videoService
        .viewVideo(this.video.uuid)
        .subscribe()

    }, viewTimeoutSeconds * 1000)
  }

  private isAutoplay () {
    // True by default
    if (!this.user) return true

    // Be sure the autoPlay is set to false
    return this.user.autoPlayVideo !== false
  }
}
