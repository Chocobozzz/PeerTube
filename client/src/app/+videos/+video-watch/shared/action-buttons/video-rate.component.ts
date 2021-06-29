import { Hotkey, HotkeysService } from 'angular2-hotkeys'
import { Observable } from 'rxjs'
import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output } from '@angular/core'
import { Notifier, ScreenService } from '@app/core'
import { VideoDetails, VideoService } from '@app/shared/shared-main'
import { UserVideoRateType } from '@shared/models'

@Component({
  selector: 'my-video-rate',
  templateUrl: './video-rate.component.html',
  styleUrls: [ './video-rate.component.scss' ]
})
export class VideoRateComponent implements OnInit, OnChanges, OnDestroy {
  @Input() video: VideoDetails
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
        new Hotkey('shift+l', () => {
          this.setLike()
          return false
        }, undefined, $localize`Like the video`),

        new Hotkey('shift+d', () => {
          this.setDislike()
          return false
        }, undefined, $localize`Dislike the video`)
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

    return $localize`You need to be <a href="/login">logged in</a> to rate this video.`
  }

  private checkUserRating () {
    // Unlogged users do not have ratings
    if (this.isUserLoggedIn === false) return

    this.videoService.getUserVideoRating(this.video.id)
        .subscribe(
          ratingObject => {
            if (!ratingObject) return

            this.userRating = ratingObject.rating
            this.userRatingLoaded.emit(this.userRating)
          },

          err => this.notifier.error(err.message)
        )
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
              this.rateUpdated.emit(this.userRating)
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
  }
}
