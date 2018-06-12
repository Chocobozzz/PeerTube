import { Component, OnInit, OnDestroy } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { Account } from '@app/shared/account/account.model'
import { AccountService } from '@app/shared/account/account.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { Subscription } from 'rxjs'

@Component({
  selector: 'my-account-about',
  templateUrl: './account-about.component.html',
  styleUrls: [ './account-about.component.scss' ]
})
export class AccountAboutComponent implements OnInit, OnDestroy {
  account: Account

  private accountSub: Subscription

  constructor (
    private route: ActivatedRoute,
    private i18n: I18n,
    private accountService: AccountService
  ) { }

  ngOnInit () {
    // Parent get the account for us
    this.accountSub = this.accountService.accountLoaded
      .subscribe(account => this.account = account)
  }

  ngOnDestroy () {
    if (this.accountSub) this.accountSub.unsubscribe()
  }

  getAccountDescription () {
    if (this.account.description) return this.account.description

    return this.i18n('No description')
  }
}
