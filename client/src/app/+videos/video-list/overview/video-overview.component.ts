import { Subject, Subscription, switchMap } from 'rxjs'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { Notifier, ScreenService, User, UserService } from '@app/core'
import { Video } from '@app/shared/shared-main/video/video.model'
import { OverviewService } from './overview.service'
import { VideosOverview } from './videos-overview.model'
import { ActorAvatarComponent } from '../../../shared/shared-actor-image/actor-avatar.component'
import { VideoMiniatureComponent } from '../../../shared/shared-video-miniature/video-miniature.component'
import { RouterLink } from '@angular/router'
import { InfiniteScrollerDirective } from '../../../shared/shared-main/common/infinite-scroller.directive'
import { NgIf, NgFor } from '@angular/common'

@Component({
  selector: 'my-video-overview',
  templateUrl: './video-overview.component.html',
  styleUrls: [ './video-overview.component.scss' ],
  standalone: true,
  imports: [ NgIf, InfiniteScrollerDirective, NgFor, RouterLink, VideoMiniatureComponent, ActorAvatarComponent ]
})
export class VideoOverviewComponent implements OnInit, OnDestroy {
  onDataSubject = new Subject<any>()

  overviews: VideosOverview[] = []
  notResults = false

  userMiniature: User

  private loaded = false
  private currentPage = 1
  private maxPage = 20
  private lastWasEmpty = false
  private isLoading = false

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

  onNearOfBottom () {
    if (this.currentPage >= this.maxPage) return
    if (this.lastWasEmpty) return
    if (this.isLoading) return

    this.currentPage++
    this.loadMoreResults()
  }

  private loadMoreResults () {
    this.isLoading = true

    this.overviewService.getVideosOverview(this.currentPage)
        .subscribe({
          next: overview => {
            this.isLoading = false

            if (overview.tags.length === 0 && overview.channels.length === 0 && overview.categories.length === 0) {
              this.lastWasEmpty = true
              if (this.loaded === false) this.notResults = true

              return
            }

            this.loaded = true
            this.onDataSubject.next(overview)

            this.overviews.push(overview)
          },

          error: err => {
            this.notifier.error(err.message)
            this.isLoading = false
          }
        })
  }
}
