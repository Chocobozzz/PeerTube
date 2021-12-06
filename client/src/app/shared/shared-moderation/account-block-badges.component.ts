import { Component, Input } from '@angular/core'
import { Account } from '../shared-main'

@Component({
  selector: 'my-account-block-badges',
  styleUrls: [ './account-block-badges.component.scss' ],
  templateUrl: './account-block-badges.component.html'
})
export class AccountBlockBadgesComponent {
  @Input() account: Account
}
