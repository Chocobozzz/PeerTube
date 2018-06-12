import { Component, OnInit, OnDestroy } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AccountService } from '@app/shared/account/account.service'
import { Account } from '@app/shared/account/account.model'
import { RestExtractor } from '@app/shared'
import { catchError, switchMap, distinctUntilChanged, map } from 'rxjs/operators'
import { Subscription } from 'rxjs'

@Component({
  templateUrl: './accounts.component.html',
  styleUrls: [ './accounts.component.scss' ]
})
export class AccountsComponent implements OnInit, OnDestroy {
  account: Account

  private routeSub: Subscription

  constructor (
    private route: ActivatedRoute,
    private accountService: AccountService,
    private restExtractor: RestExtractor
  ) {}

  ngOnInit () {
    this.routeSub = this.route.params
      .pipe(
        map(params => params[ 'accountId' ]),
        distinctUntilChanged(),
        switchMap(accountId => this.accountService.getAccount(accountId)),
        catchError(err => this.restExtractor.redirectTo404IfNotFound(err, [ 400, 404 ]))
      )
      .subscribe(account => this.account = account)
  }

  ngOnDestroy () {
    if (this.routeSub) this.routeSub.unsubscribe()
  }
}
