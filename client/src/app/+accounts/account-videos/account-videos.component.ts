import { Subscription } from 'rxjs'
import { first } from 'rxjs/operators'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { ComponentPaginationLight, DisableForReuseHook, ScreenService } from '@app/core'
import { Account, AccountService, VideoService } from '@app/shared/shared-main'
import { VideoFilters } from '@app/shared/shared-video-miniature'
import { VideoSortField } from '@peertube/peertube-models'

@Component({
  selector: 'my-account-videos',
  templateUrl: './account-videos.component.html'
})
export class AccountVideosComponent implements OnInit, OnDestroy, DisableForReuseHook {
  getVideosObservableFunction = this.getVideosObservable.bind(this)
  getSyndicationItemsFunction = this.getSyndicationItems.bind(this)

  title = $localize`Videos`
  defaultSort = '-publishedAt' as VideoSortField

  account: Account
  disabled = false

  private accountSub: Subscription

  constructor (
    private screenService: ScreenService,
    private accountService: AccountService,
    private videoService: VideoService
  ) {
  }

  ngOnInit () {
    // Parent get the account for us
    this.accountService.accountLoaded.pipe(first())
      .subscribe(account => this.account = account)
  }

  ngOnDestroy () {
    if (this.accountSub) this.accountSub.unsubscribe()
  }

  getVideosObservable (pagination: ComponentPaginationLight, filters: VideoFilters) {
    const options = {
      ...filters.toVideosAPIObject(),

      videoPagination: pagination,
      account: this.account,
      skipCount: true
    }

    return this.videoService.getAccountVideos(options)
  }

  getSyndicationItems () {
    return this.videoService.getAccountFeedUrls(this.account.id)
  }

  displayAsRow () {
    return this.screenService.isInMobileView()
  }

  disableForReuse () {
    this.disabled = true
  }

  enabledForReuse () {
    this.disabled = false
  }
}
