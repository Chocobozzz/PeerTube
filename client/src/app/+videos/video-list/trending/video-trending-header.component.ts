import { Component, Inject } from '@angular/core'
import { Router } from '@angular/router'
import { VideoListHeaderComponent } from '@app/shared/shared-video-miniature'
import { GlobalIconName } from '@app/shared/shared-icons'
import { VideoSortField } from '@shared/models'

interface VideoTrendingHeaderItem {
  label: string
  iconName: GlobalIconName
  value: VideoSortField
  path: string
  tooltip?: string
}

@Component({
  selector: 'video-trending-title-page',
  host: { 'class': 'title-page title-page-single' },
  styleUrls: [ './video-trending-header.component.scss' ],
  templateUrl: './video-trending-header.component.html'
})
export class VideoTrendingHeaderComponent extends VideoListHeaderComponent {
  buttons: VideoTrendingHeaderItem[]

  constructor (
    @Inject('data') public data: any,
    private router: Router
  ) {
    super(data)

    this.buttons = [
      {
        label: $localize`:A variant of Trending videos based on the number of recent interactions:Hot`,
        iconName: 'flame',
        value: '-hot',
        path: 'hot',
        tooltip: $localize`Videos totalizing the most interactions for recent videos`,
      },
      {
        label: $localize`:Main variant of Trending videos based on number of recent views:Views`,
        iconName: 'trending',
        value: '-trending',
        path: 'trending',
        tooltip: $localize`Videos totalizing the most views during the last 24 hours`,
      },
      {
        label: $localize`:a variant of Trending videos based on the number of likes:Likes`,
        iconName: 'like',
        value: '-likes',
        path: 'most-liked',
        tooltip: $localize`Videos that have the most likes`
      }
    ]
  }

  setSort () {
    const path = this.buttons.find(b => b.value === this.data.model).path
    this.router.navigate([ `/videos/${path}` ])
  }
}
