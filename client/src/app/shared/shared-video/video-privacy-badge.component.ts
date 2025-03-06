import { CommonModule } from '@angular/common'
import { Component, inject, input, LOCALE_ID, OnChanges } from '@angular/core'
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'
import { Video, VideoPrivacy, VideoPrivacyType } from '@peertube/peertube-models'

@Component({
  selector: 'my-video-privacy-badge',
  templateUrl: './video-privacy-badge.component.html',
  imports: [ CommonModule, NgbTooltipModule ]
})
export class VideoPrivacyBadgeComponent implements OnChanges {
  private readonly localeId = inject(LOCALE_ID)
  readonly video = input.required<Pick<Video, 'privacy' | 'scheduledUpdate'>>()

  private badges: { [id in VideoPrivacyType]: string } = {
    [VideoPrivacy.PUBLIC]: 'badge-green',
    [VideoPrivacy.INTERNAL]: 'badge-yellow',
    [VideoPrivacy.PRIVATE]: 'badge-grey',
    [VideoPrivacy.PASSWORD_PROTECTED]: 'badge-purple',
    [VideoPrivacy.UNLISTED]: 'badge-blue'
  }

  label: string
  badgeClass: string
  tooltip: string

  ngOnChanges (): void {
    this.label = this.buildLabel()
    this.badgeClass = this.buildBadgeClass()
    this.tooltip = this.buildTooltip()
  }

  buildBadgeClass () {
    return this.badges[this.video().privacy.id]
  }

  private buildLabel () {
    const video = this.video()

    if (video.scheduledUpdate) return $localize`Scheduled`

    return video.privacy.label
  }

  private buildTooltip () {
    const video = this.video()

    if (video.scheduledUpdate) {
      const updateAt = new Date(video.scheduledUpdate.updateAt.toString()).toLocaleString(this.localeId)
      return $localize`Scheduled on ${updateAt}`
    }

    return this.buildLabel()
  }
}
