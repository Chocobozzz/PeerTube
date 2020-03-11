import { Component, OnInit } from '@angular/core'
import { AuthService, Notifier } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideosOverview } from '@app/shared/overview/videos-overview.model'
import { OverviewService } from '@app/shared/overview'
import { Video } from '@app/shared/video/video.model'
import { ScreenService } from '@app/shared/misc/screen.service'
import { Subject } from 'rxjs'

@Component({
  selector: 'my-video-overview',
  templateUrl: './video-overview.component.html',
  styleUrls: [ './video-overview.component.scss' ]
})
export class VideoOverviewComponent implements OnInit {
  onDataSubject = new Subject<any>()

  overviews: VideosOverview[] = []
  notResults = false

  private loaded = false
  private currentPage = 1
  private maxPage = 20
  private lastWasEmpty = false
  private isLoading = false

  constructor (
    private i18n: I18n,
    private notifier: Notifier,
    private authService: AuthService,
    private overviewService: OverviewService,
    private screenService: ScreenService
  ) { }

  get user () {
    return this.authService.getUser()
  }

  ngOnInit () {
    this.loadMoreResults()
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
