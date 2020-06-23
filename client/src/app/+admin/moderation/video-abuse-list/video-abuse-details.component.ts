import { Component, Input } from '@angular/core'
import { Actor } from '@app/shared/shared-main'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoAbusePredefinedReasonsString } from '../../../../../../shared/models/videos/abuse/video-abuse-reason.model'
import { ProcessedVideoAbuse } from './video-abuse-list.component'
import { durationToString } from '@app/helpers'

@Component({
  selector: 'my-video-abuse-details',
  templateUrl: './video-abuse-details.component.html',
  styleUrls: [ '../moderation.component.scss' ]
})
export class VideoAbuseDetailsComponent {
  @Input() videoAbuse: ProcessedVideoAbuse

  private predefinedReasonsTranslations: { [key in VideoAbusePredefinedReasonsString]: string }

  constructor (
    private i18n: I18n
  ) {
    this.predefinedReasonsTranslations = {
      violentOrRepulsive: this.i18n('Violent or Repulsive'),
      hatefulOrAbusive: this.i18n('Hateful or Abusive'),
      spamOrMisleading: this.i18n('Spam or Misleading'),
      privacy: this.i18n('Privacy'),
      rights: this.i18n('Rights'),
      serverRules: this.i18n('Server rules'),
      thumbnails: this.i18n('Thumbnails'),
      captions: this.i18n('Captions')
    }
  }

  get startAt () {
    return durationToString(this.videoAbuse.startAt)
  }

  get endAt () {
    return durationToString(this.videoAbuse.endAt)
  }

  getPredefinedReasons () {
    if (!this.videoAbuse.predefinedReasons) return []
    return this.videoAbuse.predefinedReasons.map(r => ({
      id: r,
      label: this.predefinedReasonsTranslations[r]
    }))
  }

  switchToDefaultAvatar ($event: Event) {
    ($event.target as HTMLImageElement).src = Actor.GET_DEFAULT_AVATAR_URL()
  }
}
