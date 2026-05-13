import { Component } from '@angular/core'
import { WatchedWordsSubscriptionService } from '@app/shared/shared-watched-words/watched-words-subscription.service'
import {
  WatchedWordsSubscriptionsAdminOwnerComponent
} from '@app/shared/shared-watched-words/watched-words-subscriptions-admin-owner.component'

@Component({
  templateUrl: './my-watched-words-subscriptions.component.html',
  imports: [ WatchedWordsSubscriptionsAdminOwnerComponent ],
  providers: [ WatchedWordsSubscriptionService ]
})
export class MyWatchedWordsSubscriptionsComponent {
}
