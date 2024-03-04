import { Component, Input } from '@angular/core'
import { Account } from '../shared-main'
import { NgIf } from '@angular/common'

@Component({
  selector: 'my-account-block-badges',
  styleUrls: [ './account-block-badges.component.scss' ],
  templateUrl: './account-block-badges.component.html',
  standalone: true,
  imports: [ NgIf ]
})
export class AccountBlockBadgesComponent {
  @Input() account: Account
}
