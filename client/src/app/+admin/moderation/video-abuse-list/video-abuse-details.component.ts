import { Component, Input } from '@angular/core'
import { Actor } from '@app/shared/actor/actor.model'
import { VideoAbusePredefinedReasons } from '../../../../../../shared/models/videos/abuse/video-abuse-reason.model'
import { ProcessedVideoAbuse } from './video-abuse-list.component'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { durationToString } from '@app/shared/misc/utils'

@Component({
  selector: 'my-video-abuse-details',
  templateUrl: './video-abuse-details.component.html',
  styleUrls: [ '../moderation.component.scss' ]
})
export class VideoAbuseDetailsComponent {
  @Input() videoAbuse: ProcessedVideoAbuse

  private predefinedReasonsTranslations: { [key: number]: string }

  constructor (
    private i18n: I18n
  ) {
    this.predefinedReasonsTranslations = {
      [VideoAbusePredefinedReasons.VIOLENT_OR_REPULSIVE]: this.i18n('Violent or Repulsive'),
      [VideoAbusePredefinedReasons.HATEFUL_OR_ABUSIVE]: this.i18n('Hateful or Abusive'),
      [VideoAbusePredefinedReasons.SPAM_OR_MISLEADING]: this.i18n('Spam or Misleading'),
      [VideoAbusePredefinedReasons.PRIVACY]: this.i18n('Privacy'),
      [VideoAbusePredefinedReasons.RIGHTS]: this.i18n('Rights'),
      [VideoAbusePredefinedReasons.SERVER_RULES]: this.i18n('Server rules'),
      [VideoAbusePredefinedReasons.THUMBNAILS]: this.i18n('Thumbnails'),
      [VideoAbusePredefinedReasons.CAPTIONS]: this.i18n('Captions')
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
