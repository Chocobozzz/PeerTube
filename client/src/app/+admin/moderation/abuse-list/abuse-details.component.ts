import { Component, Input } from '@angular/core'
import { Actor } from '@app/shared/shared-main'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { AbusePredefinedReasonsString } from '@shared/models'
import { ProcessedAbuse } from './abuse-list.component'
import { durationToString } from '@app/helpers'

@Component({
  selector: 'my-abuse-details',
  templateUrl: './abuse-details.component.html',
  styleUrls: [ '../moderation.component.scss' ]
})
export class AbuseDetailsComponent {
  @Input() abuse: ProcessedAbuse

  private predefinedReasonsTranslations: { [key in AbusePredefinedReasonsString]: string }

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
    return durationToString(this.abuse.startAt)
  }

  get endAt () {
    return durationToString(this.abuse.endAt)
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
