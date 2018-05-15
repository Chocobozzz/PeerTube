import { Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { Account } from '@app/shared/account/account.model'
import { AccountService } from '@app/shared/account/account.service'

@Component({
  selector: 'my-account-about',
  templateUrl: './account-about.component.html',
  styleUrls: [ './account-about.component.scss' ]
})
export class AccountAboutComponent implements OnInit {
  account: Account

  constructor (
    protected route: ActivatedRoute,
    private accountService: AccountService
  ) { }

  ngOnInit () {
    // Parent get the account for us
    this.accountService.accountLoaded
      .subscribe(account => this.account = account)
  }

  getAccountDescription () {
    if (this.account.description) return this.account.description

    return 'No description'
  }
}
