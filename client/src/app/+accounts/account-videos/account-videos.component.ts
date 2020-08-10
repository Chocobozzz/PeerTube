import { Subscription } from 'rxjs'
import { first, tap } from 'rxjs/operators'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, ConfirmService, LocalStorageService, Notifier, ScreenService, ServerService, UserService } from '@app/core'
import { immutableAssign } from '@app/helpers'
import { Account, AccountService, VideoService } from '@app/shared/shared-main'
import { AbstractVideoList } from '@app/shared/shared-video-miniature'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-account-videos',
  templateUrl: '../../shared/shared-video-miniature/abstract-video-list.html',
  styleUrls: [
    '../../shared/shared-video-miniature/abstract-video-list.scss'
  ]
})
export class AccountVideosComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage: string
  loadOnInit = false

  private account: Account
  private accountSub: Subscription

  constructor (
    protected i18n: I18n,
    protected router: Router,
    protected serverService: ServerService,
    protected route: ActivatedRoute,
    protected authService: AuthService,
    protected userService: UserService,
    protected notifier: Notifier,
    protected confirmService: ConfirmService,
    protected screenService: ScreenService,
    protected storageService: LocalStorageService,
    private accountService: AccountService,
    private videoService: VideoService
  ) {
    super()
  }

  ngOnInit () {
    super.ngOnInit()

    // Parent get the account for us
    this.accountSub = this.accountService.accountLoaded
                          .pipe(first())
                          .subscribe(account => {
                            this.account = account

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
                 tap(({ total }) => {
                   this.titlePage = this.i18n('Published {{total}} videos', { total })
                 })
               )
  }

  generateSyndicationList () {
    this.syndicationItems = this.videoService.getAccountFeedUrls(this.account.id)
  }
}
