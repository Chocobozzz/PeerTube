import { Component, OnDestroy, OnInit } from '@angular/core'
import { Account } from '@app/shared/account/account.model'
import { AccountService } from '@app/shared/account/account.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { Subscription } from 'rxjs'
import { MarkdownService } from '@app/shared/renderer'

@Component({
  selector: 'my-account-about',
  templateUrl: './account-about.component.html',
  styleUrls: [ './account-about.component.scss' ]
})
export class AccountAboutComponent implements OnInit, OnDestroy {
  account: Account
  descriptionHTML = ''

  private accountSub: Subscription

  constructor (
    private i18n: I18n,
    private accountService: AccountService,
    private markdownService: MarkdownService
  ) { }

  ngOnInit () {
    // Parent get the account for us
    this.accountSub = this.accountService.accountLoaded
      .subscribe(async account => {
        this.account = account
        this.descriptionHTML = await this.markdownService.textMarkdownToHTML(this.account.description, true)
      })
  }

  ngOnDestroy () {
    if (this.accountSub) this.accountSub.unsubscribe()
  }

  getAccountDescription () {
    if (this.descriptionHTML) return this.descriptionHTML

    return this.i18n('No description')
  }
}
