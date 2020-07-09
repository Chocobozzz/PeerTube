import { Subscription } from 'rxjs'
import { catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators'
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AuthService, Notifier, RedirectService, RestExtractor, ScreenService, UserService } from '@app/core'
import { Account, AccountService, DropdownAction, ListOverflowItem, VideoChannel, VideoChannelService } from '@app/shared/shared-main'
import { AccountReportComponent } from '@app/shared/shared-moderation'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { User, UserRight } from '@shared/models'

@Component({
  templateUrl: './accounts.component.html',
  styleUrls: [ './accounts.component.scss' ]
})
export class AccountsComponent implements OnInit, OnDestroy {
  @ViewChild('accountReportModal') accountReportModal: AccountReportComponent

  account: Account
  accountUser: User
  videoChannels: VideoChannel[] = []
  links: ListOverflowItem[] = []

  isAccountManageable = false
  accountFollowerTitle = ''

  prependModerationActions: DropdownAction<any>[]

  private routeSub: Subscription

  constructor (
    private route: ActivatedRoute,
    private userService: UserService,
    private accountService: AccountService,
    private videoChannelService: VideoChannelService,
    private notifier: Notifier,
    private restExtractor: RestExtractor,
    private redirectService: RedirectService,
    private authService: AuthService,
    private screenService: ScreenService,
    private i18n: I18n
  ) {
  }

  ngOnInit () {
    this.routeSub = this.route.params
                        .pipe(
                          map(params => params[ 'accountId' ]),
                          distinctUntilChanged(),
                          switchMap(accountId => this.accountService.getAccount(accountId)),
                          tap(account => this.onAccount(account)),
                          switchMap(account => this.videoChannelService.listAccountVideoChannels(account)),
                          catchError(err => this.restExtractor.redirectTo404IfNotFound(err, [ 400, 404 ]))
                        )
                        .subscribe(
                          videoChannels => this.videoChannels = videoChannels.data,

                          err => this.notifier.error(err.message)
                        )

    this.links = [
      { label: this.i18n('VIDEO CHANNELS'), routerLink: 'video-channels' },
      { label: this.i18n('VIDEOS'), routerLink: 'videos' },
      { label: this.i18n('ABOUT'), routerLink: 'about' }
    ]
  }

  ngOnDestroy () {
    if (this.routeSub) this.routeSub.unsubscribe()
  }

  get naiveAggregatedSubscribers () {
    return this.videoChannels.reduce(
      (acc, val) => acc + val.followersCount,
      this.account.followersCount // accumulator starts with the base number of subscribers the account has
    )
  }

  get isInSmallView () {
    return this.screenService.isInSmallView()
  }

  onUserChanged () {
    this.getUserIfNeeded(this.account)
  }

  onUserDeleted () {
    this.redirectService.redirectToHomepage()
  }

  activateCopiedMessage () {
    this.notifier.success(this.i18n('Username copied'))
  }

  subscribersDisplayFor (count: number) {
    return this.i18n('{count, plural, =1 {1 subscriber} other {{{count}} subscribers}}', { count })
  }

  private onAccount (account: Account) {
    this.prependModerationActions = undefined

    this.account = account

    if (this.authService.isLoggedIn()) {
      this.authService.userInformationLoaded.subscribe(
        () => {
          this.isAccountManageable = this.account.userId && this.account.userId === this.authService.getUser().id

          this.accountFollowerTitle = this.i18n(
            '{{followers}} direct account followers',
            { followers: this.subscribersDisplayFor(account.followersCount) }
          )

          // It's not our account, we can report it
          if (!this.isAccountManageable) {
            this.prependModerationActions = [
              {
                label: this.i18n('Report account'),
                handler: () => this.showReportModal()
              }
            ]
          }
        }
      )
    }

    this.getUserIfNeeded(account)
  }

  private showReportModal () {
    this.accountReportModal.show()
  }

  private getUserIfNeeded (account: Account) {
    if (!account.userId || !this.authService.isLoggedIn()) return

    const user = this.authService.getUser()
    if (user.hasRight(UserRight.MANAGE_USERS)) {
      this.userService.getUser(account.userId).subscribe(
        accountUser => this.accountUser = accountUser,

        err => this.notifier.error(err.message)
      )
    }
  }
}
