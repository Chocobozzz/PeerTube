import { Component, Input } from '@angular/core'
import { durationToString } from '@app/helpers'
import { Actor } from '@app/shared/shared-main'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { AbusePredefinedReasonsString } from '@shared/models'
import { ProcessedAbuse } from './processed-abuse.model'

@Component({
  selector: 'my-abuse-details',
  templateUrl: './abuse-details.component.html',
  styleUrls: [ '../shared-moderation/moderation.scss', './abuse-details.component.scss' ]
})
export class AbuseDetailsComponent {
  @Input() abuse: ProcessedAbuse
  @Input() isAdminView: boolean
  @Input() baseRoute: string

  private predefinedReasonsTranslations: { [key in AbusePredefinedReasonsString]: string }

  constructor (
    private i18n: I18n
  ) {
    this.predefinedReasonsTranslations = {
      violentOrRepulsive: this.i18n('Violent or Repulsive'),
      hatefulOrAbusive: this.i18n('Hateful or Abusive'),
      spamOrMisleading: this.i18n('Spam or Misleading'),
      privacy: this.i18n('Privacy'),
      rights: this.i18n('Copyright'),
      serverRules: this.i18n('Server rules'),
      thumbnails: this.i18n('Thumbnails'),
      captions: this.i18n('Captions')
    }
  }

  get startAt () {
    return durationToString(this.abuse.video.startAt)
  }

  get endAt () {
    return durationToString(this.abuse.video.endAt)
  }

  getPredefinedReasons () {
    if (!this.abuse.predefinedReasons) return []

    return this.abuse.predefinedReasons.map(r => ({
      id: r,
      label: this.predefinedReasonsTranslations[r]
    }))
  }

  switchToDefaultAvatar ($event: Event) {
    ($event.target as HTMLImageElement).src = Actor.GET_DEFAULT_AVATAR_URL()
  }
}
