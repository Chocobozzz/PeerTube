import { Observable } from 'rxjs'
import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output } from '@angular/core'
import { Notifier, ScreenService, Hotkey, HotkeysService } from '@app/core'
import { UserVideoRateType } from '@peertube/peertube-models'
import { GlobalIconComponent } from '../../../../shared/shared-icons/global-icon.component'
import { NgClass, NgIf } from '@angular/common'
import { NgbPopover, NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'

@Component({
  selector: 'my-video-rate',
  templateUrl: './video-rate.component.html',
  styleUrls: [ './video-rate.component.scss' ],
  imports: [ NgbPopover, NgClass, NgbTooltip, GlobalIconComponent, NgIf ]
})
export class VideoRateComponent implements OnInit, OnChanges, OnDestroy {
  @Input() video: VideoDetails
  @Input() videoPassword: string
  @Input() isUserLoggedIn: boolean

  @Output() userRatingLoaded = new EventEmitter<UserVideoRateType>()
  @Output() rateUpdated = new EventEmitter<UserVideoRateType>()

  userRating: UserVideoRateType

  tooltipLike = ''
  tooltipDislike = ''

  private hotkeys: Hotkey[]

  constructor (
    private videoService: VideoService,
    private notifier: Notifier,
    private hotkeysService: HotkeysService,
    private screenService: ScreenService
  ) { }

  ngOnInit () {
    // Hide the tooltips for unlogged users in mobile view, this adds confusion with the popover
    if (this.isUserLoggedIn || !this.screenService.isInMobileView()) {
      this.tooltipLike = $localize`Like this video`
      this.tooltipDislike = $localize`Dislike this video`
    }

    if (this.isUserLoggedIn) {
      this.hotkeys = [
        new Hotkey('Shift+l', () => {
          this.setLike()
          return false
        }, $localize`Like the video`),

        new Hotkey('Shift+d', () => {
          this.setDislike()
          return false
        }, $localize`Dislike the video`)
      ]

      this.hotkeysService.add(this.hotkeys)
    }
  }

  ngOnChanges () {
    this.checkUserRating()
  }

  ngOnDestroy () {
    this.hotkeysService.remove(this.hotkeys)
  }

  setLike () {
    if (this.isUserLoggedIn === false) return

    // Already liked this video
    if (this.userRating === 'like') this.setRating('none')
    else this.setRating('like')
  }

  setDislike () {
    if (this.isUserLoggedIn === false) return

    // Already disliked this video
    if (this.userRating === 'dislike') this.setRating('none')
    else this.setRating('dislike')
  }

  getRatePopoverText () {
    if (this.isUserLoggedIn) return undefined

    return $localize`You need to be logged in to rate this video.`
  }

  private checkUserRating () {
    // Unlogged users do not have ratings
    if (this.isUserLoggedIn === false) return

    this.videoService.getUserVideoRating(this.video.uuid)
        .subscribe({
          next: ratingObject => {
            if (!ratingObject) return

            this.userRating = ratingObject.rating
            this.userRatingLoaded.emit(this.userRating)
          },

          error: err => this.notifier.error(err.message)
        })
  }

  private setRating (nextRating: UserVideoRateType) {
    const ratingMethods: { [id in UserVideoRateType]: (id: string, videoPassword: string) => Observable<any> } = {
      like: this.videoService.setVideoLike.bind(this.videoService),
      dislike: this.videoService.setVideoDislike.bind(this.videoService),
      none: this.videoService.unsetVideoLike.bind(this.videoService)
    }

    ratingMethods[nextRating](this.video.uuid, this.videoPassword)
      .subscribe({
        next: () => {
          // Update the video like attribute
          this.updateVideoRating(this.userRating, nextRating)
          this.userRating = nextRating
          this.rateUpdated.emit(this.userRating)
        },

        error: err => this.notifier.error(err.message)
      })
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
  }
}
