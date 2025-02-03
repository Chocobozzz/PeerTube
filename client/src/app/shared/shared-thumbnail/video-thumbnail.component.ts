import { NgClass, NgIf, NgStyle, NgTemplateOutlet } from '@angular/common'
import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core'
import { RouterLink } from '@angular/router'
import { ScreenService } from '@app/core'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { VideoState } from '@peertube/peertube-models'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { Video } from '../shared-main/video/video.model'

@Component({
  selector: 'my-video-thumbnail',
  styleUrls: [ './video-thumbnail.component.scss' ],
  templateUrl: './video-thumbnail.component.html',
  imports: [ NgIf, RouterLink, NgTemplateOutlet, NgClass, NgbTooltip, GlobalIconComponent, NgStyle ]
})
export class VideoThumbnailComponent {
  @ViewChild('watchLaterTooltip') watchLaterTooltip: NgbTooltip

  @Input() video: Video
  @Input() nsfw = false

  @Input() videoRouterLink: string | any[]
  @Input() queryParams: { [ p: string ]: any }
  @Input() videoHref: string
  @Input() videoTarget: string

  @Input() displayWatchLaterPlaylist: boolean
  @Input() inWatchLaterPlaylist: boolean

  @Input({ required: true }) ariaLabel: string

  @Output() watchLaterClick = new EventEmitter<boolean>()

  addToWatchLaterText: string
  removeFromWatchLaterText: string

  constructor (private screenService: ScreenService) {
    this.addToWatchLaterText = $localize`Add to watch later`
    this.removeFromWatchLaterText = $localize`Remove from watch later`
  }

  getWatchIconText () {
    if (this.inWatchLaterPlaylist) return this.removeFromWatchLaterText

    return this.addToWatchLaterText
  }

  isLiveStreaming () {
    // In non moderator mode we only display published live
    // If in moderator mode, the server adds the state info to the object
    if (!this.video.isLive) return false

    return !this.video.state || this.video.state?.id === VideoState.PUBLISHED
  }

  isEndedLive () {
    return this.video.state?.id === VideoState.LIVE_ENDED
  }

  getImageUrl () {
    if (!this.video) return ''

    if (this.screenService.isInMobileView()) {
      return this.video.previewUrl
    }

    return this.video.thumbnailUrl
  }

  getProgressPercent () {
    if (!this.video.userHistory) return 0

    const currentTime = this.video.userHistory.currentTime

    return Math.round((currentTime / this.video.duration)) * 100
  }

  getDurationOverlayLabel () {
    return $localize`Video duration is ${this.video.durationLabel}`
  }

  getVideoRouterLink () {
    if (this.videoRouterLink) return this.videoRouterLink

    return Video.buildWatchUrl(this.video)
  }

  onWatchLaterClick (event: Event) {
    this.watchLaterClick.emit(this.inWatchLaterPlaylist)

    event.stopPropagation()
    this.watchLaterTooltip.close()

    return false
  }
}
