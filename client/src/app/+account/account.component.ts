import { Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AccountService } from '@app/shared/account/account.service'
import { Account } from '@app/shared/account/account.model'

@Component({
  selector: 'my-account',
  templateUrl: './account.component.html',
  styleUrls: [ './account.component.scss' ]
})
export class AccountComponent implements OnInit {
  account: Account

  constructor (
    private route: ActivatedRoute,
    private accountService: AccountService
  ) {}

  ngOnInit () {
    const accountId = parseInt(this.route.snapshot.params['accountId'], 10)

    this.accountService.getAccount(accountId)
        .subscribe(account => this.account = account)
  }
}
