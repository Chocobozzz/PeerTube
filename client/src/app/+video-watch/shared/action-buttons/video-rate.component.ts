import { NgClass } from '@angular/common'
import { Component, OnChanges, OnDestroy, OnInit, inject, input, output } from '@angular/core'
import { Hotkey, HotkeysService, Notifier, ScreenService } from '@app/core'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { NgbPopover, NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { UserVideoRateType } from '@peertube/peertube-models'
import { Observable } from 'rxjs'

@Component({
  selector: 'my-video-rate',
  templateUrl: './video-rate.component.html',
  styleUrls: [ './video-rate.component.scss' ],
  imports: [ NgbPopover, NgClass, NgbTooltip, GlobalIconComponent ]
})
export class VideoRateComponent implements OnInit, OnChanges, OnDestroy {
  private videoService = inject(VideoService)
  private notifier = inject(Notifier)
  private hotkeysService = inject(HotkeysService)
  private screenService = inject(ScreenService)

  readonly video = input<VideoDetails>(undefined)
  readonly videoPassword = input<string>(undefined)
  readonly isUserLoggedIn = input<boolean>(undefined)

  readonly userRatingLoaded = output<UserVideoRateType>()
  readonly rateUpdated = output<UserVideoRateType>()

  userRating: UserVideoRateType

  tooltipLike = ''
  tooltipDislike = ''

  private hotkeys: Hotkey[]

  ngOnInit () {
    // Hide the tooltips for unlogged users in mobile view, this adds confusion with the popover
    const isUserLoggedIn = this.isUserLoggedIn()
    if (isUserLoggedIn || !this.screenService.isInMobileView()) {
      this.tooltipLike = $localize`Like this video`
      this.tooltipDislike = $localize`Dislike this video`
    }

    if (isUserLoggedIn) {
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

    return $localize`You need to be logged in to rate this video.`
  }

  private checkUserRating () {
    // Unlogged users do not have ratings
    if (this.isUserLoggedIn() === false) return

    this.videoService.getUserVideoRating(this.video().uuid)
      .subscribe({
        next: ratingObject => {
          if (!ratingObject) return

          this.userRating = ratingObject.rating
          this.userRatingLoaded.emit(this.userRating)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private setRating (nextRating: UserVideoRateType) {
    const ratingMethods: { [id in UserVideoRateType]: (id: string, videoPassword: string) => Observable<any> } = {
      like: this.videoService.setVideoLike.bind(this.videoService),
      dislike: this.videoService.setVideoDislike.bind(this.videoService),
      none: this.videoService.unsetVideoLike.bind(this.videoService)
    }

    ratingMethods[nextRating](this.video().uuid, this.videoPassword())
      .subscribe({
        next: () => {
          // Update the video like attribute
          this.updateVideoRating(this.userRating, nextRating)
          this.userRating = nextRating
          this.rateUpdated.emit(this.userRating)
        },

        error: err => this.notifier.handleError(err)
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

    const video = this.video()
    video.likes += likesToIncrement
    video.dislikes += dislikesToIncrement

    video.buildLikeAndDislikePercents()
  }
}
