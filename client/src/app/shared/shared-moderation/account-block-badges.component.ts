import { booleanAttribute, Component, input } from '@angular/core'
import { Account } from '../shared-main/account/account.model'

export type AccountBlockBadgeInput = Partial<
  Pick<
    Account,
    | 'mutedByUser'
    | 'mutedServerByUser'
    | 'mutedByInstance'
    | 'mutedByInstanceSubscription'
    | 'mutedServerByInstance'
    | 'mutedServerByInstanceSubscription'
  >
>

@Component({
  selector: 'my-account-block-badges',
  styleUrls: [ './account-block-badges.component.scss' ],
  templateUrl: './account-block-badges.component.html',
  imports: []
})
export class AccountBlockBadgesComponent {
  readonly account = input.required<AccountBlockBadgeInput>()

  readonly platformOnly = input(false, { transform: booleanAttribute })

  getSubscriptionTitle (subscriptionName: string | undefined) {
    if (!subscriptionName) return undefined

    return $localize`Muted by subscription "${subscriptionName}"`
  }
}
