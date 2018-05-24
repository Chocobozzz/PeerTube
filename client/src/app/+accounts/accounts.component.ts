import { Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AccountService } from '@app/shared/account/account.service'
import { Account } from '@app/shared/account/account.model'

@Component({
  templateUrl: './accounts.component.html',
  styleUrls: [ './accounts.component.scss' ]
})
export class AccountsComponent implements OnInit {
  account: Account

  constructor (
    private route: ActivatedRoute,
    private accountService: AccountService
  ) {}

  ngOnInit () {
    const accountId = this.route.snapshot.params['accountId']

    this.accountService.getAccount(accountId)
        .subscribe(account => this.account = account)
  }
}
