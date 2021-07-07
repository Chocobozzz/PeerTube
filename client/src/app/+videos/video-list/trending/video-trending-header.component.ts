import { Subscription } from 'rxjs'
import { Component, HostBinding, Inject, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, RedirectService } from '@app/core'
import { ServerService } from '@app/core/server/server.service'
import { GlobalIconName } from '@app/shared/shared-icons'
import { VideoListHeaderComponent } from '@app/shared/shared-video-miniature'

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
    private auth: AuthService,
    private serverService: ServerService,
    private redirectService: RedirectService
  ) {
    super(data)

    this.buttons = [
      {
        label: $localize`:A variant of Trending videos based on the number of recent interactions, minus user history:Best`,
        iconName: 'award',
        value: 'best',
        tooltip: $localize`Videos with the most interactions for recent videos, minus user history`,
        hidden: true
      },
      {
        label: $localize`:A variant of Trending videos based on the number of recent interactions:Hot`,
        iconName: 'flame',
        value: 'hot',
        tooltip: $localize`Videos with the most interactions for recent videos`,
        hidden: true
      },
      {
        label: $localize`:Main variant of Trending videos based on number of recent views:Views`,
        iconName: 'trending',
        value: 'most-viewed',
        tooltip: $localize`Videos with the most views during the last 24 hours`
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
    const serverConfig = this.serverService.getHTMLConfig()
    const algEnabled = serverConfig.trending.videos.algorithms.enabled

    this.buttons = this.buttons.map(b => {
      b.hidden = !algEnabled.includes(b.value)

      // Best is adapted by the user history so
      if (b.value === 'best' && !this.auth.isLoggedIn()) {
        b.hidden = true
      }

      return b
    })

    this.algorithmChangeSub = this.route.queryParams.subscribe(
      queryParams => {
        this.data.model = queryParams['alg'] || this.redirectService.getDefaultTrendingAlgorithm()
      }
    )
  }

  ngOnDestroy () {
    if (this.algorithmChangeSub) this.algorithmChangeSub.unsubscribe()
  }

  setSort () {
    const alg = this.data.model !== this.redirectService.getDefaultTrendingAlgorithm()
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
