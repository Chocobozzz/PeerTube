import { Component, Input } from '@angular/core'
import { durationToString } from '@app/helpers'
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
}
