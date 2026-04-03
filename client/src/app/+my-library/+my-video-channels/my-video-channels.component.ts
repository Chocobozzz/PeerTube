import { Component, OnInit, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, RouterLink } from '@angular/router'
import {
  AuthService,
  ComponentPagination,
  ConfirmService,
  Notifier,
  PeerTubeRouterService,
  ScreenService,
  hasMoreItems,
  resetCurrentPage,
  updatePaginationOnDelete
} from '@app/core'
import { formatICU } from '@app/helpers'
import { SelectOptionsComponent } from '@app/shared/shared-forms/select/select-options.component'
import { CollaboratorStateComponent } from '@app/shared/shared-main/channel/collaborator-state.component'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { maxBy, minBy } from '@peertube/peertube-core-utils'
import { SelectOptionsItem } from '@pt-types'
import { ChartData, ChartOptions, TooltipItem, TooltipModel } from 'chart.js'
import { ChartModule } from 'primeng/chart'
import { Subject, first, switchMap, tap } from 'rxjs'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { SearchInputComponent } from '../../shared/shared-forms/search-input.component'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { DeleteButtonComponent } from '../../shared/shared-main/buttons/delete-button.component'
import { EditButtonComponent } from '../../shared/shared-main/buttons/edit-button.component'
import { ChannelsSetupMessageComponent } from '../../shared/shared-main/channel/channels-setup-message.component'
import { DeferLoadingDirective } from '../../shared/shared-main/common/defer-loading.directive'
import { InfiniteScrollerDirective } from '../../shared/shared-main/common/infinite-scroller.directive'
import { NumberFormatterPipe } from '../../shared/shared-main/common/number-formatter.pipe'

type CustomChartData = ChartData & { startDate: string, total: number }
type DisplayFilter = 'all' | 'owned'

@Component({
  templateUrl: './my-video-channels.component.html',
  styleUrls: [ './my-video-channels.component.scss' ],
  imports: [
    GlobalIconComponent,
    FormsModule,
    RouterLink,
    ChannelsSetupMessageComponent,
    SearchInputComponent,
    InfiniteScrollerDirective,
    ActorAvatarComponent,
    EditButtonComponent,
    DeleteButtonComponent,
    DeferLoadingDirective,
    ChartModule,
    NumberFormatterPipe,
    SelectOptionsComponent,
    CollaboratorStateComponent
  ]
})
export class MyVideoChannelsComponent implements OnInit {
  private authService = inject(AuthService)
  private notifier = inject(Notifier)
  private confirmService = inject(ConfirmService)
  private videoChannelService = inject(VideoChannelService)
  private screenService = inject(ScreenService)
  private route = inject(ActivatedRoute)
  private peertubeRouter = inject(PeerTubeRouterService)

  videoChannels: VideoChannel[] = []

  videoChannelsChartData: CustomChartData[]

  chartOptions: ChartOptions

  search: string

  onChannelDataSubject = new Subject<any>()

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }

  displayFilter: DisplayFilter = 'all'
  displayFilterItems: SelectOptionsItem[] = [
    { id: 'all', label: $localize`All channels` },
    { id: 'owned', label: $localize`Only channels owned by me` }
  ]

  private pagesDone = new Set<number>()

  get isInSmallView () {
    return this.screenService.isInSmallView()
  }

  get user () {
    return this.authService.getUser()
  }

  ngOnInit () {
    if (this.route.snapshot.queryParamMap.get('displayFilter') === 'owned') {
      this.displayFilter = 'owned'
    }
  }

  isOwned (channel: VideoChannel) {
    return channel.ownerAccount.id === this.authService.getUser().account.id
  }

  onDisplayFilterChanged () {
    this.peertubeRouter.silentNavigate([], {
      ...this.route.snapshot.queryParams,

      displayFilter: this.displayFilter === 'all'
        ? null
        : this.displayFilter
    })

    this.resetDataAndReload()
  }

  onSearch (search: string) {
    this.search = search

    this.resetDataAndReload()
  }

  // ---------------------------------------------------------------------------

  private resetDataAndReload () {
    resetCurrentPage(this.pagination)
    this.videoChannels = []
    this.pagesDone.clear()

    this.loadMoreVideoChannels()
  }

  deleteVideoChannel (videoChannel: VideoChannel) {
    this.videoChannelService.removeWithConfirmation(videoChannel)
      .subscribe({
        next: removed => {
          if (!removed) return

          this.videoChannels = this.videoChannels.filter(c => c.id !== videoChannel.id)
          this.notifier.success($localize`Video channel ${videoChannel.displayName} deleted.`)

          updatePaginationOnDelete(this.pagination)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  onNearOfBottom () {
    if (!hasMoreItems(this.pagination)) return

    this.pagination.currentPage += 1

    this.loadMoreVideoChannels()
  }

  private loadMoreVideoChannels () {
    if (this.pagesDone.has(this.pagination.currentPage)) return
    this.pagesDone.add(this.pagination.currentPage)

    const channelBaseOptions = {
      account: this.authService.getUser().account,
      search: this.search,
      componentPagination: this.pagination,
      includeCollaborations: this.displayFilter === 'all',
      sort: '-updatedAt'
    }

    const base = this.authService.userInformationLoaded.pipe(first())

    // Load channels without stats first to display something as soon as possible, then load stats in a second time
    base.pipe(
      switchMap(() => this.videoChannelService.listAccountChannels(channelBaseOptions)),
      tap(res => {
        this.videoChannels = this.videoChannels.concat(res.data)
        this.pagination.totalItems = res.total

        this.onChannelDataSubject.next(res.data)
      }),
      switchMap(() => this.videoChannelService.listAccountChannels({ ...channelBaseOptions, withStats: true }))
    ).subscribe({
      next: res => {
        for (const channelWithStats of res.data) {
          const channel = this.videoChannels.find(c => c.id === channelWithStats.id)

          channel.viewsPerDay = channelWithStats.viewsPerDay
          channel.videosCount = channelWithStats.videosCount
          channel.totalViews = channelWithStats.totalViews
        }

        this.videoChannelsChartData = this.videoChannels.map(v => ({
          labels: v.viewsPerDay.map(day => day.date.toLocaleDateString()),
          datasets: [
            {
              label: $localize`Views for the day`,
              data: v.viewsPerDay.map(day => day.views),
              fill: false,
              borderColor: '#c6c6c6'
            }
          ],

          total: v.viewsPerDay.map(day => day.views)
            .reduce((p, c) => p + c, 0),

          startDate: v.viewsPerDay.length !== 0
            ? v.viewsPerDay[0].date.toLocaleDateString()
            : ''
        }))

        this.buildChartOptions()
      },

      error: err => this.notifier.handleError(err)
    })
  }

  // ---------------------------------------------------------------------------

  private buildChartOptions () {
    const channelsMinimumDailyViews = Math.min(...this.videoChannels.map(v => minBy(v.viewsPerDay, 'views').views))
    const channelsMaximumDailyViews = Math.max(...this.videoChannels.map(v => maxBy(v.viewsPerDay, 'views').views))

    this.chartOptions = {
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          external: function ({ tooltip }: { tooltip: TooltipModel<any> }) {
            if (!tooltip) return

            // disable displaying the color box
            tooltip.options.displayColors = false
          },
          callbacks: {
            label: (tooltip: TooltipItem<any>) => `${tooltip.formattedValue} views`
          }
        }
      },
      scales: {
        x: {
          display: false
        },
        y: {
          display: false,
          min: Math.max(0, channelsMinimumDailyViews - (3 * channelsMaximumDailyViews / 100)),
          max: Math.max(1, channelsMaximumDailyViews)
        }
      },
      layout: {
        padding: {
          left: 15,
          right: 15,
          top: 10,
          bottom: 0
        }
      },
      elements: {
        point: {
          radius: 0
        }
      },
      hover: {
        mode: 'index',
        intersect: false
      }
    }
  }

  getChartAriaLabel (data: CustomChartData) {
    if (!data.startDate) return ''

    return formatICU($localize`${data.total} {value, plural, =1 {view} other {views}} since ${data.startDate}`, { value: data.total })
  }

  // ---------------------------------------------------------------------------

  getTotalTitle () {
    return formatICU(
      $localize`${this.pagination.totalItems} {total, plural, =1 {channel} other {channels}}`,
      { total: this.pagination.totalItems }
    )
  }
}
