import { Component, ChangeDetectionStrategy } from '@angular/core'
import { WatchedWordsSubscriptionService } from '@app/shared/shared-watched-words/watched-words-subscription.service'
import {
  WatchedWordsSubscriptionsAdminOwnerComponent
} from '@app/shared/shared-watched-words/watched-words-subscriptions-admin-owner.component'

@Component({
  templateUrl: './watched-words-subscriptions.component.html',
  imports: [ WatchedWordsSubscriptionsAdminOwnerComponent ],
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [ WatchedWordsSubscriptionService ]
})
export class WatchedWordsSubscriptionsComponent {
}
