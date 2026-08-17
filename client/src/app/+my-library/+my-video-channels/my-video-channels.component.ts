import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, RouterLink } from '@angular/router'
import {
  AuthService,
  ComponentPagination,
  ComponentPaginationLight,
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
import { maxBy } from '@peertube/peertube-core-utils'
import {
  VIDEO_CHANNEL_STATS_DAYS_ALL_TIME,
  VIDEO_CHANNEL_STATS_DAYS_DEFAULT,
  VIDEO_CHANNEL_STATS_DAYS_OPTIONS,
  VideoChannelStatsDays,
  VideoChannelStatsGroupInterval,
  getVideoChannelStatsGroupInterval
} from '@peertube/peertube-models'
import { SelectOptionsItem } from '@pt-types'
import { ChartData, ChartOptions, TooltipItem } from 'chart.js'
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

type CustomChartData = ChartData & { startDate: string, total: number, tooltipTitles: string[] }
type DisplayFilter = 'all' | 'owned'

@Component({
  templateUrl: './my-video-channels.component.html',
  styleUrls: [ './my-video-channels.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
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
  private videoChannelService = inject(VideoChannelService)
  private screenService = inject(ScreenService)
  private route = inject(ActivatedRoute)
  private peertubeRouter = inject(PeerTubeRouterService)

  videoChannels: VideoChannel[] = []

  videoChannelsChartData: { [id: number]: CustomChartData } = {}

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

  statsDays: VideoChannelStatsDays = VIDEO_CHANNEL_STATS_DAYS_DEFAULT
  statsDaysItems: SelectOptionsItem<VideoChannelStatsDays>[] = [
    { id: VIDEO_CHANNEL_STATS_DAYS_DEFAULT, label: $localize`Last 30 days` },
    { id: 90, label: $localize`Last 90 days` },
    { id: 365, label: $localize`Last year` },
    { id: VIDEO_CHANNEL_STATS_DAYS_ALL_TIME, label: $localize`All time` }
  ]

  private pagesDone = new Set<number>()

  get displayChart () {
    return !this.screenService.isInMediumView()
  }

  get user () {
    return this.authService.getUser()
  }

  ngOnInit () {
    if (this.route.snapshot.queryParamMap.get('displayFilter') === 'owned') {
      this.displayFilter = 'owned'
    }

    const statsDays = parseInt(this.route.snapshot.queryParamMap.get('statsDays'), 10)
    if (VIDEO_CHANNEL_STATS_DAYS_OPTIONS.includes(statsDays as VideoChannelStatsDays)) {
      this.statsDays = statsDays as VideoChannelStatsDays
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
    this.videoChannelsChartData = {}
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

  private getChannelBaseOptions () {
    return {
      account: this.authService.getUser().account,
      search: this.search,
      componentPagination: this.pagination,
      includeCollaborations: this.displayFilter === 'all',
      sort: '-updatedAt'
    }
  }

  private loadMoreVideoChannels () {
    if (this.pagesDone.has(this.pagination.currentPage)) return
    this.pagesDone.add(this.pagination.currentPage)

    const channelBaseOptions = this.getChannelBaseOptions()

    // Snapshot the pagination so the stats request targets the same window as the list request
    const statsPagination = { ...this.pagination }

    const base = this.authService.userInformationLoaded.pipe(first())

    // Load channels without stats first to display something as soon as possible, then load stats in a second time
    base.pipe(
      switchMap(() => this.videoChannelService.listAccountChannels(channelBaseOptions)),
      tap(res => {
        this.videoChannels = this.videoChannels.concat(res.data)
        this.pagination.totalItems = res.total

        this.onChannelDataSubject.next(res.data)
      })
    ).subscribe({
      // Only fetch stats for the page that was just loaded, not every channel loaded so far
      next: () => this.loadChannelsStats(statsPagination),

      error: err => this.notifier.handleError(err)
    })
  }

  onStatsDaysChanged () {
    this.peertubeRouter.silentNavigate([], {
      ...this.route.snapshot.queryParams,

      statsDays: this.statsDays === VIDEO_CHANNEL_STATS_DAYS_DEFAULT
        ? null
        : this.statsDays
    })

    if (this.videoChannels.length === 0) return

    // Refresh all channel stats, chunked by 100 (the max count accepted server side)
    const chunkSize = Math.min(this.videoChannels.length, 100)

    for (let start = 0; start < this.videoChannels.length; start += chunkSize) {
      this.loadChannelsStats({
        currentPage: (start / chunkSize) + 1,
        itemsPerPage: chunkSize
      })
    }
  }

  private loadChannelsStats (componentPagination: ComponentPaginationLight) {
    const channelBaseOptions = this.getChannelBaseOptions()
    const requestedStatsDays = this.statsDays

    this.videoChannelService.listAccountChannels({
      ...channelBaseOptions,
      withStats: true,
      statsDays: requestedStatsDays,
      componentPagination
    }).subscribe({
      next: res => {
        // statsDays changed again since this request was sent: a newer request will supersede it
        if (requestedStatsDays !== this.statsDays) return

        for (const channelWithStats of res.data) {
          const channel = this.videoChannels.find(c => c.id === channelWithStats.id)
          if (!channel) continue

          channel.viewsPerDay = channelWithStats.viewsPerDay
          channel.viewsGroupInterval = channelWithStats.viewsGroupInterval
          channel.videosCount = channelWithStats.videosCount
          channel.totalViews = channelWithStats.totalViews
        }

        const barColor = getComputedStyle(document.documentElement).getPropertyValue('--border-primary')

        for (const v of this.videoChannels) {
          const viewsPerDay = v.viewsPerDay || []
          const groupInterval = v.viewsGroupInterval || getVideoChannelStatsGroupInterval(this.statsDays)

          this.videoChannelsChartData[v.id] = {
            labels: viewsPerDay.map(day => this.formatStatsAxisLabel(day.date, groupInterval)),
            tooltipTitles: viewsPerDay.map(day => this.formatStatsTooltipTitle(day.date, groupInterval)),
            datasets: [
              {
                label: $localize`Views`,
                data: viewsPerDay.map(day => day.views),
                backgroundColor: barColor,
                hoverBackgroundColor: barColor,
                maxBarThickness: 16,
                borderRadius: 2
              }
            ],

            total: viewsPerDay.map(day => day.views)
              .reduce((p, c) => p + c, 0),

            startDate: viewsPerDay.length !== 0
              ? this.formatStatsAxisLabel(viewsPerDay[0].date, groupInterval)
              : ''
          }
        }

        this.buildChartOptions()
      },

      error: err => this.notifier.handleError(err)
    })
  }

  // ---------------------------------------------------------------------------

  private formatStatsAxisLabel (date: Date, groupInterval: VideoChannelStatsGroupInterval) {
    if (groupInterval === 'month') {
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
    }

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  private formatStatsTooltipTitle (date: Date, groupInterval: VideoChannelStatsGroupInterval) {
    if (groupInterval === 'month') {
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
    }

    if (groupInterval === 'week') {
      const weekStart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      return $localize`Week of ${weekStart}`
    }

    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  private buildChartOptions () {
    const channelsWithStats = this.videoChannels.filter(v => v.viewsPerDay?.length)
    if (channelsWithStats.length === 0) return

    const channelsMaximumDailyViews = Math.max(...channelsWithStats.map(v => maxBy(v.viewsPerDay, 'views').views))
    const styles = getComputedStyle(document.documentElement)
    const tickColor = styles.getPropertyValue('--fg-300')
    const gridColor = styles.getPropertyValue('--bg-secondary-350')

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          displayColors: false,
          callbacks: {
            title: items => {
              const item = items[0]
              if (!item) return ''

              const tooltipTitles = (item.chart.data as CustomChartData).tooltipTitles
              return tooltipTitles?.[item.dataIndex] ?? item.label ?? ''
            },
            label: (tooltip: TooltipItem<any>) =>
              formatICU(
                $localize`${tooltip.raw} {value, plural, =1 {view} other {views}}`,
                { value: tooltip.raw as number }
              )
          }
        }
      },
      scales: {
        x: {
          display: true,
          border: {
            display: false
          },
          grid: {
            display: false
          },
          ticks: {
            autoSkip: true,
            maxTicksLimit: 4,
            maxRotation: 0,
            color: tickColor,
            font: {
              size: 11
            }
          }
        },
        y: {
          display: true,
          beginAtZero: true,
          suggestedMax: Math.max(1, channelsMaximumDailyViews),
          border: {
            display: false
          },
          grid: {
            color: gridColor
          },
          ticks: {
            maxTicksLimit: 3,
            color: tickColor,
            font: {
              size: 11
            },
            callback: value => {
              const n = Number(value)
              if (!Number.isFinite(n)) return value

              return Math.abs(n) >= 1000
                ? `${Math.round(n / 100) / 10}k`
                : n
            }
          }
        }
      },
      layout: {
        padding: {
          left: 0,
          right: 4,
          top: 4,
          bottom: 0
        }
      },
      interaction: {
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
