import { NgIf } from '@angular/common'
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ComponentPaginationLight, DisableForReuseHook, ScreenService } from '@app/core'
import { Account } from '@app/shared/shared-main/account/account.model'
import { AccountService } from '@app/shared/shared-main/account/account.service'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { VideoFilters } from '@app/shared/shared-video-miniature/video-filters.model'
import { VideoSortField } from '@peertube/peertube-models'
import { Subscription } from 'rxjs'
import { VideosListComponent } from '../../shared/shared-video-miniature/videos-list.component'

@Component({
  selector: 'my-account-videos',
  templateUrl: './account-videos.component.html',
  standalone: true,
  imports: [ NgIf, VideosListComponent ]
})
export class AccountVideosComponent implements OnInit, OnDestroy, DisableForReuseHook {
  @ViewChild('videosList') videosList: VideosListComponent

  getVideosObservableFunction = this.getVideosObservable.bind(this)
  getSyndicationItemsFunction = this.getSyndicationItems.bind(this)

  defaultSort = '-publishedAt' as VideoSortField

  account: Account
  disabled = false

  private alreadyLoaded = false

  private accountSub: Subscription

  constructor (
    private screenService: ScreenService,
    private accountService: AccountService,
    private videoService: VideoService
  ) {
  }

  ngOnInit () {
    // Parent get the account for us
    this.accountSub = this.accountService.accountLoaded
      .subscribe(account => {
        this.account = account
        if (this.alreadyLoaded) this.videosList.reloadVideos()

        this.alreadyLoaded = true
      })
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
