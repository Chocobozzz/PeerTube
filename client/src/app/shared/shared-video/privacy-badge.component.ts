import { CommonModule } from '@angular/common'
import { Component, inject, input, LOCALE_ID, OnChanges } from '@angular/core'
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'
import { Video, VideoPlaylistPrivacy, VideoPlaylistPrivacyType, VideoPrivacy, VideoPrivacyType } from '@peertube/peertube-models'
import { VideoPlaylist } from '../shared-video-playlist/video-playlist.model'

@Component({
  selector: 'my-privacy-badge',
  templateUrl: './privacy-badge.component.html',
  imports: [ CommonModule, NgbTooltipModule ]
})
export class PrivacyBadgeComponent implements OnChanges {
  private readonly localeId = inject(LOCALE_ID)

  readonly video = input<Pick<Video, 'privacy' | 'scheduledUpdate'>>(undefined)
  readonly playlist = input<Pick<VideoPlaylist, 'privacy'>>(undefined)

  private videoBadges: { [id in VideoPrivacyType]: string } = {
    [VideoPrivacy.PUBLIC]: 'badge-green',
    [VideoPrivacy.INTERNAL]: 'badge-yellow',
    [VideoPrivacy.PRIVATE]: 'badge-grey',
    [VideoPrivacy.PASSWORD_PROTECTED]: 'badge-purple',
    [VideoPrivacy.UNLISTED]: 'badge-blue',
    [VideoPrivacy.PREMIERE]: 'badge-yellow'
  }

  private playlistBadges: { [id in VideoPlaylistPrivacyType]: string } = {
    [VideoPlaylistPrivacy.PUBLIC]: 'badge-green',
    [VideoPlaylistPrivacy.PRIVATE]: 'badge-grey',
    [VideoPlaylistPrivacy.UNLISTED]: 'badge-blue'
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
    if (this.video()) return this.videoBadges[this.video().privacy.id]

    if (this.playlist()) return this.playlistBadges[this.playlist().privacy.id]

    throw new Error('Missing video or playlist input in PrivacyBadgeComponent')
  }

  private buildLabel () {
    if (this.video()) {
      // For PREMIERE videos, always show "Premiere" even if scheduled
      if (this.video().privacy.id === VideoPrivacy.PREMIERE) {
        return this.video().privacy.label
      }
      
      // For other privacy types, show "Scheduled" if there's a scheduled update
      if (this.video().scheduledUpdate) return $localize`Scheduled`

      return this.video().privacy.label
    }

    if (this.playlist()) {
      return this.playlist().privacy.label
    }

    return ''
  }

  private buildTooltip () {
    if (this.video()?.scheduledUpdate) {
      const updateAt = new Date(this.video().scheduledUpdate.updateAt.toString()).toLocaleString(this.localeId)
      
      if (this.video().privacy.id === VideoPrivacy.PREMIERE) {
        return $localize`Premieres on ${updateAt}`
      }
      
      return $localize`Scheduled on ${updateAt}`
    }

    return this.buildLabel()
  }
}
