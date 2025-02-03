import { Component, Input } from '@angular/core'
import { NgIf } from '@angular/common'
import { Account } from '../shared-main/account/account.model'

@Component({
  selector: 'my-account-block-badges',
  styleUrls: [ './account-block-badges.component.scss' ],
  templateUrl: './account-block-badges.component.html',
  imports: [ NgIf ]
})
export class AccountBlockBadgesComponent {
  @Input() account: Account
}
