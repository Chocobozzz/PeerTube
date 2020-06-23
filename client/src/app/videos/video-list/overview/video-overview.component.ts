import { Subject } from 'rxjs'
import { Component, OnInit } from '@angular/core'
import { Notifier, ScreenService, User, UserService } from '@app/core'
import { Video } from '@app/shared/shared-main'
import { OverviewService } from './overview.service'
import { VideosOverview } from './videos-overview.model'

@Component({
  selector: 'my-video-overview',
  templateUrl: './video-overview.component.html',
  styleUrls: [ './video-overview.component.scss' ]
})
export class VideoOverviewComponent implements OnInit {
  onDataSubject = new Subject<any>()

  overviews: VideosOverview[] = []
  notResults = false

  userMiniature: User

  private loaded = false
  private currentPage = 1
  private maxPage = 20
  private lastWasEmpty = false
  private isLoading = false

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

    this.userService.listenAnonymousUpdate()
      .subscribe(user => this.userMiniature = user)
  }

  buildVideoChannelBy (object: { videos: Video[] }) {
    return object.videos[0].byVideoChannel
  }

  buildVideoChannelAvatarUrl (object: { videos: Video[] }) {
    return object.videos[0].videoChannelAvatarUrl
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
        .subscribe(
          overview => {
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

          err => {
            this.notifier.error(err.message)
            this.isLoading = false
          }
        )
  }
}
