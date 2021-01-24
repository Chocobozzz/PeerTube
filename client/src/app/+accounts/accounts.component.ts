import { Subscription } from 'rxjs'
import { catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators'
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AuthService, Notifier, RedirectService, RestExtractor, ScreenService, UserService } from '@app/core'
import { Account, AccountService, DropdownAction, ListOverflowItem, VideoChannel, VideoChannelService } from '@app/shared/shared-main'
import { AccountReportComponent } from '@app/shared/shared-moderation'
import { User, UserRight } from '@shared/models'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'
import { AccountSearchComponent } from './account-search/account-search.component'

@Component({
  templateUrl: './accounts.component.html',
  styleUrls: [ './accounts.component.scss' ]
})
export class AccountsComponent implements OnInit, OnDestroy {
  @ViewChild('accountReportModal') accountReportModal: AccountReportComponent
  accountSearch: AccountSearchComponent

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
    private screenService: ScreenService
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
                          catchError(err => this.restExtractor.redirectTo404IfNotFound(err, 'other', [
                            HttpStatusCode.BAD_REQUEST_400,
                            HttpStatusCode.NOT_FOUND_404
                          ]))
                        )
                        .subscribe(
                          videoChannels => this.videoChannels = videoChannels.data,

                          err => this.notifier.error(err.message)
                        )

    this.links = [
      { label: $localize`VIDEO CHANNELS`, routerLink: 'video-channels' },
      { label: $localize`VIDEOS`, routerLink: 'videos' },
      { label: $localize`ABOUT`, routerLink: 'about' }
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
    this.notifier.success($localize`Username copied`)
  }

  subscribersDisplayFor (count: number) {
    if (count === 1) return $localize`1 subscriber`

    return $localize`${count} subscribers`
  }

  onOutletLoaded (component: Component) {
    if (component instanceof AccountSearchComponent) {
      this.accountSearch = component
    } else {
      this.accountSearch = undefined
    }
  }

  searchChanged (search: string) {
    if (this.accountSearch) this.accountSearch.updateSearch(search)
  }

  private onAccount (account: Account) {
    this.prependModerationActions = undefined

    this.account = account

    if (this.authService.isLoggedIn()) {
      this.authService.userInformationLoaded.subscribe(
        () => {
          this.isAccountManageable = this.account.userId && this.account.userId === this.authService.getUser().id

          const followers = this.subscribersDisplayFor(account.followersCount)
          this.accountFollowerTitle = $localize`${followers} direct account followers`

          // It's not our account, we can report it
          if (!this.isAccountManageable) {
            this.prependModerationActions = [
              {
                label: $localize`Report this account`,
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
