import { CommonModule } from '@angular/common'
import { Component, input, OnChanges } from '@angular/core'
import { Video, VideoPrivacy, VideoState, VideoStateType } from '@peertube/peertube-models'

@Component({
  selector: 'my-video-state-badge',
  templateUrl: './video-state-badge.component.html',
  imports: [ CommonModule ]
})
export class VideoStateBadgeComponent implements OnChanges {
  readonly video = input.required<Pick<Video, 'privacy' | 'state' | 'waitTranscoding' | 'scheduledUpdate'>>()

  private states: { [id in VideoStateType]: string } = {
    [VideoState.PUBLISHED]: 'badge-green',
    [VideoState.TO_TRANSCODE]: 'badge-brown',
    [VideoState.TO_IMPORT]: 'badge-brown',
    [VideoState.TO_IMPORT_FAILED]: 'badge-red',
    [VideoState.WAITING_FOR_LIVE]: 'badge-blue',
    [VideoState.LIVE_ENDED]: 'badge-green',
    [VideoState.TO_MOVE_TO_EXTERNAL_STORAGE]: 'badge-brown',
    [VideoState.TRANSCODING_FAILED]: 'badge-red',
    [VideoState.TO_MOVE_TO_EXTERNAL_STORAGE_FAILED]: 'badge-red',
    [VideoState.TO_EDIT]: 'badge-brown',
    [VideoState.TO_MOVE_TO_FILE_SYSTEM]: 'badge-brown',
    [VideoState.TO_MOVE_TO_FILE_SYSTEM_FAILED]: 'badge-brown'
  }

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
    this.badgeClass = this.states[video.state.id]

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

        if (video.privacy.id === VideoPrivacy.PREMIERE && video.scheduledUpdate) {
          this.label = $localize`Scheduled`
          this.badgeClass = 'badge-yellow'
          return
        }

        this.label = $localize`Published`
        return

      case VideoState.WAITING_FOR_LIVE:
        this.label = $localize`Waiting live`
        return

      case VideoState.LIVE_ENDED:
        this.label = $localize`Live ended`
        return

      case VideoState.TRANSCODING_FAILED:
        this.label = $localize`Transcoding failed`
        return

      case VideoState.TO_MOVE_TO_FILE_SYSTEM:
        this.label = $localize`Moving to file system`
        return

      case VideoState.TO_MOVE_TO_FILE_SYSTEM_FAILED:
        this.label = $localize`Moving to file system failed`
        return

      case VideoState.TO_MOVE_TO_EXTERNAL_STORAGE:
        this.label = $localize`Moving to external storage`
        return

      case VideoState.TO_MOVE_TO_EXTERNAL_STORAGE_FAILED:
        this.label = $localize`Move to external storage failed`
        return

      case VideoState.TO_TRANSCODE:
        this.label = this.video().waitTranscoding === true
          ? $localize`Waiting transcoding`
          : $localize`To transcode`
        return

      case VideoState.TO_IMPORT:
        this.label = $localize`To import`
        return

      case VideoState.TO_IMPORT_FAILED:
        this.label = $localize`Import failed`
        return

      case VideoState.TO_EDIT:
        this.label = $localize`To edit`
        return

      default:
        return state satisfies never
    }
  }
}
