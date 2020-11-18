import { Component, Input } from '@angular/core'
import { durationToString } from '@app/helpers'
import { Account } from '@app/shared/shared-main'
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

  constructor () {
    this.predefinedReasonsTranslations = {
      violentOrRepulsive: $localize`Violent or Repulsive`,
      hatefulOrAbusive: $localize`Hateful or Abusive`,
      spamOrMisleading: $localize`Spam or Misleading`,
      privacy: $localize`Privacy`,
      rights: $localize`Copyright`,
      serverRules: $localize`Server rules`,
      thumbnails: $localize`Thumbnails`,
      captions: $localize`Captions`
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
    ($event.target as HTMLImageElement).src = Account.GET_DEFAULT_AVATAR_URL()
  }
}
