import { NgClass, NgIf, NgStyle, NgTemplateOutlet } from '@angular/common'
import { Component, inject, input, output, viewChild } from '@angular/core'
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
  private screenService = inject(ScreenService)

  readonly watchLaterTooltip = viewChild<NgbTooltip>('watchLaterTooltip')

  readonly video = input<Video>(undefined)
  readonly nsfw = input(false)

  readonly videoRouterLink = input<string | any[]>(undefined)
  readonly queryParams = input<{
    [p: string]: any
  }>(undefined)
  readonly videoHref = input<string>(undefined)
  readonly videoTarget = input<string>(undefined)

  readonly displayWatchLaterPlaylist = input<boolean>(undefined)
  readonly inWatchLaterPlaylist = input<boolean>(undefined)

  readonly ariaLabel = input.required<string>()

  readonly watchLaterClick = output<boolean>()

  addToWatchLaterText: string
  removeFromWatchLaterText: string

  constructor () {
    this.addToWatchLaterText = $localize`Add to watch later`
    this.removeFromWatchLaterText = $localize`Remove from watch later`
  }

  getWatchIconText () {
    if (this.inWatchLaterPlaylist()) return this.removeFromWatchLaterText

    return this.addToWatchLaterText
  }

  isLiveStreaming () {
    // In non moderator mode we only display published live
    // If in moderator mode, the server adds the state info to the object
    const video = this.video()
    if (!video.isLive) return false

    return !video.state || video.state?.id === VideoState.PUBLISHED
  }

  isEndedLive () {
    return this.video().state?.id === VideoState.LIVE_ENDED
  }

  getImageUrl () {
    const video = this.video()
    if (!video) return ''

    if (this.screenService.isInMobileView()) {
      return video.previewUrl
    }

    return video.thumbnailUrl
  }

  getProgressPercent () {
    const video = this.video()
    if (!video.userHistory) return 0

    const currentTime = video.userHistory.currentTime

    return Math.round(currentTime / video.duration * 100)
  }

  getDurationOverlayLabel () {
    return $localize`Video duration is ${this.video().durationLabel}`
  }

  getVideoRouterLink () {
    const videoRouterLink = this.videoRouterLink()
    if (videoRouterLink) return videoRouterLink

    return Video.buildWatchUrl(this.video())
  }

  onWatchLaterClick (event: Event) {
    this.watchLaterClick.emit(this.inWatchLaterPlaylist())

    event.stopPropagation()
    this.watchLaterTooltip().close()

    return false
  }
}
