import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AccountService } from '@app/shared/account/account.service'
import { Account } from '@app/shared/account/account.model'
import { RestExtractor, UserService } from '@app/shared'
import { catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators'
import { Subscription } from 'rxjs'
import { AuthService, Notifier, RedirectService } from '@app/core'
import { User, UserRight } from '../../../../shared'

@Component({
  templateUrl: './accounts.component.html',
  styleUrls: [ './accounts.component.scss' ]
})
export class AccountsComponent implements OnInit, OnDestroy {
  account: Account
  user: User

  private routeSub: Subscription

  constructor (
    private route: ActivatedRoute,
    private userService: UserService,
    private accountService: AccountService,
    private notifier: Notifier,
    private restExtractor: RestExtractor,
    private redirectService: RedirectService,
    private authService: AuthService
  ) {}

  ngOnInit () {
    this.routeSub = this.route.params
      .pipe(
        map(params => params[ 'accountId' ]),
        distinctUntilChanged(),
        switchMap(accountId => this.accountService.getAccount(accountId)),
        tap(account => this.getUserIfNeeded(account)),
        catchError(err => this.restExtractor.redirectTo404IfNotFound(err, [ 400, 404 ]))
      )
      .subscribe(
        account => this.account = account,

        err => this.notifier.error(err.message)
      )
  }

  ngOnDestroy () {
    if (this.routeSub) this.routeSub.unsubscribe()
  }

  onUserChanged () {
    this.getUserIfNeeded(this.account)
  }

  onUserDeleted () {
    this.redirectService.redirectToHomepage()
  }

  private getUserIfNeeded (account: Account) {
    if (!account.userId) return
    if (!this.authService.isLoggedIn()) return

    const user = this.authService.getUser()
    if (user.hasRight(UserRight.MANAGE_USERS)) {
      this.userService.getUser(account.userId)
          .subscribe(
            user => this.user = user,

            err => this.notifier.error(err.message)
          )
    }
  }
}
