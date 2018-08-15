import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Location } from '@angular/common'
import { immutableAssign } from '@app/shared/misc/utils'
import { NotificationsService } from 'angular2-notifications'
import { AuthService } from '../../core/auth'
import { ConfirmService } from '../../core/confirm'
import { AbstractVideoList } from '../../shared/video/abstract-video-list'
import { VideoService } from '../../shared/video/video.service'
import { Account } from '@app/shared/account/account.model'
import { AccountService } from '@app/shared/account/account.service'
import { tap } from 'rxjs/operators'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { Subscription } from 'rxjs'
import { ScreenService } from '@app/shared/misc/screen.service'

@Component({
  selector: 'my-account-videos',
  templateUrl: '../../shared/video/abstract-video-list.html',
  styleUrls: [
    '../../shared/video/abstract-video-list.scss',
    './account-videos.component.scss'
  ]
})
export class AccountVideosComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage: string
  marginContent = false // Disable margin
  currentRoute = '/accounts/videos'
  loadOnInit = false

  private account: Account
  private accountSub: Subscription

  constructor (
    protected router: Router,
    protected route: ActivatedRoute,
    protected authService: AuthService,
    protected notificationsService: NotificationsService,
    protected confirmService: ConfirmService,
    protected location: Location,
    protected screenService: ScreenService,
    protected i18n: I18n,
    private accountService: AccountService,
    private videoService: VideoService
  ) {
    super()

    this.titlePage = this.i18n('Published videos')
  }

  ngOnInit () {
    super.ngOnInit()

    // Parent get the account for us
    this.accountSub = this.accountService.accountLoaded
      .subscribe(account => {
        this.account = account
        this.currentRoute = '/accounts/' + this.account.nameWithHost + '/videos'

        this.reloadVideos()
        this.generateSyndicationList()
      })
  }

  ngOnDestroy () {
    if (this.accountSub) this.accountSub.unsubscribe()

    super.ngOnDestroy()
  }

  getVideosObservable (page: number) {
    const newPagination = immutableAssign(this.pagination, { currentPage: page })

    return this.videoService
               .getAccountVideos(this.account, newPagination, this.sort)
               .pipe(
                 tap(({ totalVideos }) => {
                   this.titlePage = this.i18n('Published {{totalVideos}} videos', { totalVideos })
                 })
               )
  }

  generateSyndicationList () {
    this.syndicationItems = this.videoService.getAccountFeedUrls(this.account.id)
  }
}
