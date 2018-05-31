import { Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AccountService } from '@app/shared/account/account.service'
import { Account } from '@app/shared/account/account.model'
import { RestExtractor } from '@app/shared'
import { catchError } from 'rxjs/operators'

@Component({
  templateUrl: './accounts.component.html',
  styleUrls: [ './accounts.component.scss' ]
})
export class AccountsComponent implements OnInit {
  account: Account

  constructor (
    private route: ActivatedRoute,
    private accountService: AccountService,
    private restExtractor: RestExtractor
  ) {}

  ngOnInit () {
    const accountId = this.route.snapshot.params['accountId']

    this.accountService.getAccount(accountId)
        .pipe(catchError(err => this.restExtractor.redirectTo404IfNotFound(err, [ 400, 404 ])))
        .subscribe(account => this.account = account)
  }
}
