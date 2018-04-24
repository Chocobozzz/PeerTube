import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Location } from '@angular/common'
import { getParameterByName, immutableAssign } from '@app/shared/misc/utils'
import { NotificationsService } from 'angular2-notifications'
import 'rxjs/add/observable/from'
import 'rxjs/add/operator/concatAll'
import { AuthService } from '../../core/auth'
import { ConfirmService } from '../../core/confirm'
import { AbstractVideoList } from '../../shared/video/abstract-video-list'
import { VideoService } from '../../shared/video/video.service'
import { Account } from '@app/shared/account/account.model'
import { AccountService } from '@app/shared/account/account.service'

@Component({
  selector: 'my-account-about',
  templateUrl: './account-about.component.html',
  styleUrls: [ './account-about.component.scss' ]
})
export class AccountAboutComponent implements OnInit {
  private account: Account

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
