import { Subscription, switchMap } from 'rxjs'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { Notifier, ScreenService, User, UserService } from '@app/core'
import { Video } from '@app/shared/shared-main/video/video.model'
import { OverviewService } from './overview.service'
import { VideosOverview } from './videos-overview.model'
import { ActorAvatarComponent } from '../../../shared/shared-actor-image/actor-avatar.component'
import { VideoMiniatureComponent } from '../../../shared/shared-video-miniature/video-miniature.component'
import { RouterLink } from '@angular/router'
import { InfiniteScrollerComponent } from '../../../shared/shared-main/common/infinite-scroller.component'
import { NgIf, NgFor } from '@angular/common'

@Component({
  selector: 'my-video-overview',
  templateUrl: './video-overview.component.html',
  styleUrls: [ './video-overview.component.scss' ],
  standalone: true,
  imports: [ NgIf, InfiniteScrollerComponent, NgFor, RouterLink, VideoMiniatureComponent, ActorAvatarComponent ]
})
export class VideoOverviewComponent implements OnInit, OnDestroy {
  hasMoreResults = true

  overviews: VideosOverview[] = []
  notResults = false

  userMiniature: User
  currentPage = 1
  isLoading = true

  private loaded = false
  private maxPage = 20
  private lastWasEmpty = false

  private userSub: Subscription

  constructor (
    private notifier: Notifier,
    private userService: UserService,
    private overviewService: OverviewService,
    private screenService: ScreenService
  ) { }

  ngOnInit () {
    this.loadMoreResults()

    this.userService.getAnonymousOrLoggedUser()
      .subscribe(user => this.userMiniature = user)

    this.userSub = this.userService.listenAnonymousUpdate()
      .pipe(switchMap(() => this.userService.getAnonymousOrLoggedUser()))
      .subscribe(user => {
        this.userMiniature = user

        this.overviews = []
        this.loadMoreResults()
      })
  }

  ngOnDestroy () {
    if (this.userSub) this.userSub.unsubscribe()
  }

  buildVideoChannelBy (object: { videos: Video[] }) {
    return object.videos[0].byVideoChannel
  }

  buildVideoChannel (object: { videos: Video[] }) {
    return object.videos[0].channel
  }

  buildVideos (videos: Video[]) {
    const numberOfVideos = this.screenService.getNumberOfAvailableMiniatures()

    return videos.slice(0, numberOfVideos * 2)
  }

  onPageChange () {
    this.loadMoreResults(true)
  }

  onNearOfBottom () {
    if (this.currentPage >= this.maxPage) return
    if (this.lastWasEmpty) return

    this.currentPage++
    this.loadMoreResults()
  }

  private loadMoreResults (reset = false) {
    this.isLoading = true

    this.overviewService.getVideosOverview(this.currentPage)
        .subscribe({
          next: overview => {
            this.isLoading = false
            this.hasMoreResults = this.currentPage < this.maxPage

            if (overview.tags.length === 0 && overview.channels.length === 0 && overview.categories.length === 0) {
              this.lastWasEmpty = true
              if (this.loaded === false) this.notResults = true

              return
            }

            this.loaded = true

            if (reset) this.overviews = []
            this.overviews.push(overview)
          },

          error: err => {
            this.notifier.error(err.message)
            this.isLoading = false
          }
        })
  }
}
