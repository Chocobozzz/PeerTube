import { CommonModule } from '@angular/common'
import { Component, input, OnChanges, ChangeDetectionStrategy } from '@angular/core'
import { Video, VideoPrivacy, VideoState } from '@peertube/peertube-models'
import { getVideoStateBadgeClass, getVideoStateLabel } from './video-state-utils'

@Component({
  selector: 'my-video-state-badge',
  templateUrl: './video-state-badge.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ CommonModule ]
})
export class VideoStateBadgeComponent implements OnChanges {
  readonly video = input.required<Pick<Video, 'privacy' | 'state' | 'waitTranscoding'>>()

  label: string
  badgeClass: string

  ngOnChanges (): void {
    this.buildBadgeAndLabel()
  }

  private buildBadgeAndLabel () {
    const video = this.video()

    if (!video.state) {
      this.label = ''
      return
    }

    const state = video.state.id
    this.badgeClass = getVideoStateBadgeClass(video.state.id)

    switch (state) {
      case VideoState.PUBLISHED:
        if (video.privacy.id === VideoPrivacy.PRIVATE) {
          this.label = $localize`In your library`
          this.badgeClass = 'badge-grey'
          return
        }

        if (video.privacy.id === VideoPrivacy.INTERNAL) {
          this.label = $localize`Internal`
          this.badgeClass = 'badge-blue'
          return
        }

        this.label = getVideoStateLabel(video.state.id)
        return

      case VideoState.TO_TRANSCODE:
        this.label = this.video().waitTranscoding === true
          ? $localize`Waiting transcoding`
          : $localize`To transcode`
        return

      default:
        this.label = getVideoStateLabel(video.state.id)
    }
  }
}
