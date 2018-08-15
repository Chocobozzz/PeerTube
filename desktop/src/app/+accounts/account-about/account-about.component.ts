import { Component, OnInit, OnDestroy } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { Account } from '@app/shared/account/account.model'
import { AccountService } from '@app/shared/account/account.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { Subscription } from 'rxjs'
import { MarkdownService } from '@app/videos/shared'

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
    private route: ActivatedRoute,
    private i18n: I18n,
    private accountService: AccountService,
    private markdownService: MarkdownService
  ) { }

  ngOnInit () {
    // Parent get the account for us
    this.accountSub = this.accountService.accountLoaded
      .subscribe(account => {
        this.account = account
        this.descriptionHTML = this.markdownService.textMarkdownToHTML(this.account.description)
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
