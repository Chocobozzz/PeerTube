import { Component, Inject, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { VideoListHeaderComponent } from '@app/shared/shared-video-miniature'
import { GlobalIconName } from '@app/shared/shared-icons'
import { VideoSortField } from '@shared/models'
import { ServerService } from '@app/core/server/server.service'

interface VideoTrendingHeaderItem {
  label: string
  iconName: GlobalIconName
  value: VideoSortField
  path: string
  tooltip?: string
  hidden?: boolean
}

@Component({
  selector: 'video-trending-title-page',
  host: { 'class': 'title-page title-page-single' },
  styleUrls: [ './video-trending-header.component.scss' ],
  templateUrl: './video-trending-header.component.html'
})
export class VideoTrendingHeaderComponent extends VideoListHeaderComponent implements OnInit {
  buttons: VideoTrendingHeaderItem[]

  constructor (
    @Inject('data') public data: any,
    private router: Router,
    private serverService: ServerService
  ) {
    super(data)

    this.buttons = [
      {
        label: $localize`:A variant of Trending videos based on the number of recent interactions:Hot`,
        iconName: 'flame',
        value: '-hot',
        path: 'hot',
        tooltip: $localize`Videos totalizing the most interactions for recent videos`,
        hidden: true
      },
      {
        label: $localize`:Main variant of Trending videos based on number of recent views:Views`,
        iconName: 'trending',
        value: '-trending',
        path: 'most-viewed',
        tooltip: $localize`Videos totalizing the most views during the last 24 hours`,
      },
      {
        label: $localize`:A variant of Trending videos based on the number of likes:Likes`,
        iconName: 'like',
        value: '-likes',
        path: 'most-liked',
        tooltip: $localize`Videos that have the most likes`
      }
    ]
  }

  ngOnInit () {
    this.serverService.getConfig()
        .subscribe(config => {
          // don't filter if auto-blacklist is not enabled as this will be the only list
          if (config.instance.pages.hot.enabled) {
            const index = this.buttons.findIndex(b => b.path === 'hot')
            this.buttons[index].hidden = false
          }
        })
  }

  get visibleButtons () {
    return this.buttons.filter(b => !b.hidden)
  }

  setSort () {
    const path = this.buttons.find(b => b.value === this.data.model).path
    this.router.navigate([ `/videos/${path}` ])
  }
}
