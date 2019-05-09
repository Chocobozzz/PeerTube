import { Component, OnInit } from '@angular/core'
import { AuthService, Notifier } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideosOverview } from '@app/shared/overview/videos-overview.model'
import { OverviewService } from '@app/shared/overview'
import { Video } from '@app/shared/video/video.model'

@Component({
  selector: 'my-video-overview',
  templateUrl: './video-overview.component.html',
  styleUrls: [ './video-overview.component.scss' ]
})
export class VideoOverviewComponent implements OnInit {
  overview: VideosOverview = {
    categories: [],
    channels: [],
    tags: []
  }
  notResults = false

  constructor (
    private i18n: I18n,
    private notifier: Notifier,
    private authService: AuthService,
    private overviewService: OverviewService
  ) { }

  get user () {
    return this.authService.getUser()
  }

  ngOnInit () {
    this.overviewService.getVideosOverview()
        .subscribe(
          overview => {
            this.overview = overview

            if (
              this.overview.categories.length === 0 &&
              this.overview.channels.length === 0 &&
              this.overview.tags.length === 0
            ) this.notResults = true
          },

          err => this.notifier.error(err.message)
        )
  }

  buildVideoChannelBy (object: { videos: Video[] }) {
    return object.videos[0].byVideoChannel
  }

  buildVideoChannelAvatarUrl (object: { videos: Video[] }) {
    return object.videos[0].videoChannelAvatarUrl
  }
}
