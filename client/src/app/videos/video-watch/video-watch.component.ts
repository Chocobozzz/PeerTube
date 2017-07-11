import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Observable } from 'rxjs/Observable'
import { Subscription } from 'rxjs/Subscription'

import videojs from 'video.js'
import { MetaService } from '@ngx-meta/core'
import { NotificationsService } from 'angular2-notifications'

import { AuthService, ConfirmService } from '../../core'
import { VideoMagnetComponent } from './video-magnet.component'
import { VideoShareComponent } from './video-share.component'
import { VideoReportComponent } from './video-report.component'
import { Video, VideoService } from '../shared'
import { WebTorrentService } from './webtorrent.service'
import { UserVideoRateType, VideoRateType, UserVideoRate } from '../../../../../shared'

@Component({
  selector: 'my-video-watch',
  templateUrl: './video-watch.component.html',
  styleUrls: [ './video-watch.component.scss' ]
})
export class VideoWatchComponent implements OnInit, OnDestroy {
  private static LOADTIME_TOO_LONG = 20000

  @ViewChild('videoMagnetModal') videoMagnetModal: VideoMagnetComponent
  @ViewChild('videoShareModal') videoShareModal: VideoShareComponent
  @ViewChild('videoReportModal') videoReportModal: VideoReportComponent

  downloadSpeed: number
  error = false
  loading = false
  numPeers: number
  player: videojs.Player
  playerElement: HTMLMediaElement
  uploadSpeed: number
  userRating: UserVideoRateType = null
  video: Video = null
  videoNotFound = false

  private errorTimer: number
  private paramsSub: Subscription
  private errorsSub: Subscription
  private torrentInfosInterval: number

  constructor (
    private elementRef: ElementRef,
    private ngZone: NgZone,
    private route: ActivatedRoute,
    private router: Router,
    private videoService: VideoService,
    private confirmService: ConfirmService,
    private metaService: MetaService,
    private webTorrentService: WebTorrentService,
    private authService: AuthService,
    private notificationsService: NotificationsService
  ) {}

  ngOnInit () {
    this.paramsSub = this.route.params.subscribe(routeParams => {
      let id = routeParams['id']
      this.videoService.getVideo(id).subscribe(
        video => this.onVideoFetched(video),

        error => {
          console.error(error)
          this.videoNotFound = true
        }
      )
    })

    this.playerElement = this.elementRef.nativeElement.querySelector('#video-container')

    const videojsOptions = {
      controls: true,
      autoplay: true
    }

    const self = this
    videojs(this.playerElement, videojsOptions, function () {
      self.player = this
    })

    this.errorsSub = this.webTorrentService.errors.subscribe(err => {
      const message = typeof err === 'string' ? err : err.message
      this.notificationsService.error('Error', message)
    })
  }

  ngOnDestroy () {
    // Remove WebTorrent stuff
    console.log('Removing video from webtorrent.')
    window.clearInterval(this.torrentInfosInterval)
    window.clearTimeout(this.errorTimer)

    if (this.video !== null && this.webTorrentService.has(this.video.magnetUri)) {
      this.webTorrentService.remove(this.video.magnetUri)
    }

    // Remove player
    videojs(this.playerElement).dispose()

    // Unsubscribe subscriptions
    this.paramsSub.unsubscribe()
    this.errorsSub.unsubscribe()
  }

  loadVideo () {
    // Reset the error
    this.error = false
    // We are loading the video
    this.loading = true

    console.log('Adding ' + this.video.magnetUri + '.')

    // The callback might never return if there are network issues
    // So we create a timer to inform the user the load is abnormally long
    this.errorTimer = window.setTimeout(() => this.loadTooLong(), VideoWatchComponent.LOADTIME_TOO_LONG)

    this.webTorrentService.add(this.video.magnetUri, torrent => {
      // Clear the error timer
      window.clearTimeout(this.errorTimer)
      // Maybe the error was fired by the timer, so reset it
      this.error = false

      // We are not loading the video anymore
      this.loading = false

      console.log('Added ' + this.video.magnetUri + '.')
      torrent.files[0].renderTo(this.playerElement, (err) => {
        if (err) {
          this.notificationsService.error('Error', 'Cannot append the file in the video element.')
          console.error(err)
        }

        // Hack to "simulate" src link in video.js >= 6
        // If no, we can't play the video after pausing it
        // https://github.com/videojs/video.js/blob/master/src/js/player.js#L1633
        (this.player as any).src = () => true

        this.player.play()
      })

      this.runInProgress(torrent)
    })
  }

  setLike () {
    if (this.isUserLoggedIn() === false) return
    // Already liked this video
    if (this.userRating === 'like') return

    this.videoService.setVideoLike(this.video.id)
                     .subscribe(
                      () => {
                        // Update the video like attribute
                        this.updateVideoRating(this.userRating, 'like')
                        this.userRating = 'like'
                      },

                      err => this.notificationsService.error('Error', err.text)
                     )
  }

  setDislike () {
    if (this.isUserLoggedIn() === false) return
    // Already disliked this video
    if (this.userRating === 'dislike') return

    this.videoService.setVideoDislike(this.video.id)
                     .subscribe(
                      () => {
                        // Update the video dislike attribute
                        this.updateVideoRating(this.userRating, 'dislike')
                        this.userRating = 'dislike'
                      },

                      err => this.notificationsService.error('Error', err.text)
                     )
  }

  removeVideo (event: Event) {
    event.preventDefault()

    this.confirmService.confirm('Do you really want to delete this video?', 'Delete').subscribe(
      res => {
        if (res === false) return

        this.videoService.removeVideo(this.video.id)
                         .subscribe(
                           status => {
                             this.notificationsService.success('Success', `Video ${this.video.name} deleted.`)
                             // Go back to the video-list.
                             this.router.navigate(['/videos/list'])
                           },

                           error => this.notificationsService.error('Error', error.text)
                          )
      }
    )
  }

  blacklistVideo (event: Event) {
    event.preventDefault()

    this.confirmService.confirm('Do you really want to blacklist this video ?', 'Blacklist').subscribe(
      res => {
        if (res === false) return

        this.videoService.blacklistVideo(this.video.id)
                         .subscribe(
                           status => {
                             this.notificationsService.success('Success', `Video ${this.video.name} had been blacklisted.`)
                             this.router.navigate(['/videos/list'])
                           },

                           error => this.notificationsService.error('Error', error.text)
                         )
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

  showMagnetUriModal (event: Event) {
    event.preventDefault()
    this.videoMagnetModal.show()
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  canUserUpdateVideo () {
    return this.video.isUpdatableBy(this.authService.getUser())
  }

  isVideoRemovable () {
    return this.video.isRemovableBy(this.authService.getUser())
  }

  isVideoBlacklistable () {
    return this.video.isBlackistableBy(this.authService.getUser())
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

                       err => this.notificationsService.error('Error', err.text)
                      )
  }

  private onVideoFetched (video: Video) {
    this.video = video

    let observable
    if (this.video.isVideoNSFWForUser(this.authService.getUser())) {
      observable = this.confirmService.confirm('This video is not safe for work. Are you sure you want to watch it?', 'NSFW')
    } else {
      observable = Observable.of(true)
    }

    observable.subscribe(
      res => {
        if (res === false) {
          return this.router.navigate([ '/videos/list' ])
        }

        this.setOpenGraphTags()
        this.loadVideo()
        this.checkUserRating()
      }
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

  private loadTooLong () {
    this.error = true
    console.error('The video load seems to be abnormally long.')
  }

  private setOpenGraphTags () {
    this.metaService.setTitle(this.video.name)

    this.metaService.setTag('og:type', 'video')

    this.metaService.setTag('og:title', this.video.name)
    this.metaService.setTag('name', this.video.name)

    this.metaService.setTag('og:description', this.video.description)
    this.metaService.setTag('description', this.video.description)

    this.metaService.setTag('og:image', this.video.thumbnailPath)

    this.metaService.setTag('og:duration', this.video.duration.toString())

    this.metaService.setTag('og:site_name', 'PeerTube')

    this.metaService.setTag('og:url', window.location.href)
    this.metaService.setTag('url', window.location.href)
  }

  private runInProgress (torrent: any) {
    // Refresh each second
    this.torrentInfosInterval = window.setInterval(() => {
      this.ngZone.run(() => {
        this.downloadSpeed = torrent.downloadSpeed
        this.numPeers = torrent.numPeers
        this.uploadSpeed = torrent.uploadSpeed
      })
    }, 1000)
  }
}
