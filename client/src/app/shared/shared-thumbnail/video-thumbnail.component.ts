import { CommonModule } from '@angular/common'
import { booleanAttribute, Component, inject, input, OnChanges, output, viewChild } from '@angular/core'
import { RouterLink } from '@angular/router'
import { ScreenService } from '@app/core'
import { getAPIUrl } from '@app/helpers'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { Video as VideoServerModel, VideoState } from '@peertube/peertube-models'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { Video } from '../shared-main/video/video.model'
import { FromNowPipe } from '../shared-main/date/from-now.pipe'

export type VideoThumbnailInput = Pick<
  VideoServerModel,
  | 'duration'
  | 'id'
  | 'uuid'
  | 'shortUUID'
  | 'isLive'
  | 'state'
  | 'previewPath'
  | 'previewUrl'
  | 'thumbnailPath'
  | 'thumbnailUrl'
  | 'userHistory'
  | 'originallyPublishedAt'
  | 'liveSchedules'
>

@Component({
  selector: 'my-video-thumbnail',
  styleUrls: [ './video-thumbnail.component.scss' ],
  templateUrl: './video-thumbnail.component.html',
  imports: [ CommonModule, RouterLink, NgbTooltip, GlobalIconComponent, FromNowPipe ]
})
export class VideoThumbnailComponent implements OnChanges {
  private screenService = inject(ScreenService)

  readonly video = input.required<VideoThumbnailInput>()

  readonly videoRouterLink = input<string | any[]>(undefined)
  readonly queryParams = input<{
    [p: string]: any
  }>(undefined)
  readonly videoHref = input<string>(undefined)
  readonly videoTarget = input<string>(undefined)

  readonly displayWatchLaterPlaylist = input<boolean, boolean | string>(false, { transform: booleanAttribute })
  readonly inWatchLaterPlaylist = input<boolean, boolean | string>(false, { transform: booleanAttribute })
  readonly playOverlay = input<boolean, boolean | string>(true, { transform: booleanAttribute })

  readonly ariaLabel = input.required<string>()
  readonly blur = input.required({ transform: booleanAttribute })

  readonly watchLaterTooltip = viewChild<NgbTooltip>('watchLaterTooltip')
  readonly watchLaterClick = output<boolean>()

  addToWatchLaterText: string
  removeFromWatchLaterText: string

  durationLabel: string

  constructor () {
    this.addToWatchLaterText = $localize`Add to watch later`
    this.removeFromWatchLaterText = $localize`Remove from watch later`
  }

  ngOnChanges () {
    this.durationLabel = this.video().duration
      ? Video.buildDurationLabel(this.video())
      : undefined
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

  isScheduledLive () {
    return this.video().state?.id === VideoState.WAITING_FOR_LIVE &&
      this.video().liveSchedules !== null &&
      this.video().liveSchedules.length > 0
  }

  scheduledLiveDate () {
    return new Date(this.video().liveSchedules[0].startAt)
  }

  getImageUrl () {
    const video = this.video()
    if (!video) return ''

    if (this.screenService.isInMobileView()) {
      return video.previewUrl || getAPIUrl() + video.previewPath
    }

    return video.thumbnailUrl || getAPIUrl() + video.thumbnailPath
  }

  getProgressPercent () {
    const video = this.video()
    if (!video.userHistory) return 0

    const currentTime = video.userHistory.currentTime

    return Math.round(currentTime / video.duration * 100)
  }

  getDurationOverlayLabel () {
    return $localize`Video duration is ${this.getDurationLabel()}`
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

  getDurationLabel () {
    return this.durationLabel
  }
}
