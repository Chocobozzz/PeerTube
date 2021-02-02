import { Component, HostBinding, Inject, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { VideoListHeaderComponent } from '@app/shared/shared-video-miniature'
import { GlobalIconName } from '@app/shared/shared-icons'
import { ServerService } from '@app/core/server/server.service'
import { Subscription } from 'rxjs'
import { RedirectService } from '@app/core'

interface VideoTrendingHeaderItem {
  label: string
  iconName: GlobalIconName
  value: string
  tooltip?: string
  hidden?: boolean
}

@Component({
  selector: 'video-trending-title-page',
  styleUrls: [ './video-trending-header.component.scss' ],
  templateUrl: './video-trending-header.component.html'
})
export class VideoTrendingHeaderComponent extends VideoListHeaderComponent implements OnInit, OnDestroy {
  @HostBinding('class') class = 'title-page title-page-single'

  buttons: VideoTrendingHeaderItem[]

  private algorithmChangeSub: Subscription

  constructor (
    @Inject('data') public data: any,
    private route: ActivatedRoute,
    private router: Router,
    private serverService: ServerService
  ) {
    super(data)

    this.buttons = [
      {
        label: $localize`:A variant of Trending videos based on the number of recent interactions, minus user history:Best`,
        iconName: 'award',
        value: 'best',
        tooltip: $localize`Videos totalizing the most interactions for recent videos, minus user history`,
        hidden: true
      },
      {
        label: $localize`:A variant of Trending videos based on the number of recent interactions:Hot`,
        iconName: 'flame',
        value: 'hot',
        tooltip: $localize`Videos totalizing the most interactions for recent videos`,
        hidden: true
      },
      {
        label: $localize`:Main variant of Trending videos based on number of recent views:Views`,
        iconName: 'trending',
        value: 'most-viewed',
        tooltip: $localize`Videos totalizing the most views during the last 24 hours`
      },
      {
        label: $localize`:A variant of Trending videos based on the number of likes:Likes`,
        iconName: 'like',
        value: 'most-liked',
        tooltip: $localize`Videos that have the most likes`
      }
    ]
  }

  ngOnInit () {
    this.serverService.getConfig()
        .subscribe(config => {
          this.buttons = this.buttons.map(b => {
            b.hidden = !config.trending.videos.algorithms.enabled.includes(b.value)
            return b
          })
        })

    this.algorithmChangeSub = this.route.queryParams.subscribe(
      queryParams => {
        const algorithm = queryParams['alg']
        if (algorithm) {
          this.data.model = algorithm
        } else {
          this.data.model = RedirectService.DEFAULT_TRENDING_ALGORITHM
        }
      }
    )
  }

  ngOnDestroy () {
    if (this.algorithmChangeSub) this.algorithmChangeSub.unsubscribe()
  }

  setSort () {
    const alg = this.data.model !== RedirectService.DEFAULT_TRENDING_ALGORITHM
      ? this.data.model
      : undefined

    this.router.navigate(
      [],
      {
        relativeTo: this.route,
        queryParams: { alg },
        queryParamsHandling: 'merge'
      }
    )
  }
}
