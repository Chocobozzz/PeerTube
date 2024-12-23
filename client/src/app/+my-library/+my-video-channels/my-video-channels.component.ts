import { NgFor, NgIf } from '@angular/common'
import { Component } from '@angular/core'
import { RouterLink } from '@angular/router'
import {
  AuthService,
  ComponentPagination,
  ConfirmService,
  Notifier,
  ScreenService,
  hasMoreItems,
  resetCurrentPage,
  updatePaginationOnDelete
} from '@app/core'
import { formatICU } from '@app/helpers'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { maxBy, minBy } from '@peertube/peertube-core-utils'
import { ChartData, ChartOptions, TooltipItem, TooltipModel } from 'chart.js'
import { ChartModule } from 'primeng/chart'
import { Subject, first, map, switchMap } from 'rxjs'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { AdvancedInputFilterComponent } from '../../shared/shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { DeleteButtonComponent } from '../../shared/shared-main/buttons/delete-button.component'
import { EditButtonComponent } from '../../shared/shared-main/buttons/edit-button.component'
import { ChannelsSetupMessageComponent } from '../../shared/shared-main/channel/channels-setup-message.component'
import { DeferLoadingDirective } from '../../shared/shared-main/common/defer-loading.directive'
import { InfiniteScrollerDirective } from '../../shared/shared-main/common/infinite-scroller.directive'
import { NumberFormatterPipe } from '../../shared/shared-main/common/number-formatter.pipe'

type CustomChartData = (ChartData & { startDate: string, total: number })

@Component({
  templateUrl: './my-video-channels.component.html',
  styleUrls: [ './my-video-channels.component.scss' ],
  standalone: true,
  imports: [
    GlobalIconComponent,
    NgIf,
    RouterLink,
    ChannelsSetupMessageComponent,
    AdvancedInputFilterComponent,
    InfiniteScrollerDirective,
    NgFor,
    ActorAvatarComponent,
    EditButtonComponent,
    DeleteButtonComponent,
    DeferLoadingDirective,
    ChartModule,
    NumberFormatterPipe
  ]
})
export class MyVideoChannelsComponent {
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

  private pagesDone = new Set<number>()

  constructor (
    private authService: AuthService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private videoChannelService: VideoChannelService,
    private screenService: ScreenService
  ) {}

  get isInSmallView () {
    return this.screenService.isInSmallView()
  }

  onSearch (search: string) {
    this.search = search

    resetCurrentPage(this.pagination)
    this.videoChannels = []
    this.pagesDone.clear()

    this.loadMoreVideoChannels()
  }

  async deleteVideoChannel (videoChannel: VideoChannel) {
    const res = await this.confirmService.confirmWithExpectedInput(
      $localize`Do you really want to delete ${videoChannel.displayName}?` +
      `<br />` +
      formatICU(
        // eslint-disable-next-line max-len
        $localize`It will delete {count, plural, =1 {1 video} other {{count} videos}} uploaded in this channel, and you will not be able to create another channel or account with the same name (${videoChannel.name})!`,
        { count: videoChannel.videosCount }
      ),

      $localize`Please type the name of the video channel (${videoChannel.name}) to confirm`,

      videoChannel.name,

      $localize`Delete`
    )
    if (res === false) return

    this.videoChannelService.removeVideoChannel(videoChannel)
      .subscribe({
        next: () => {
          this.videoChannels = this.videoChannels.filter(c => c.id !== videoChannel.id)
          this.notifier.success($localize`Video channel ${videoChannel.displayName} deleted.`)

          updatePaginationOnDelete(this.pagination)
        },

        error: err => this.notifier.error(err.message)
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

    return this.authService.userInformationLoaded
      .pipe(
        first(),
        map(() => ({
          account: this.authService.getUser().account,
          withStats: true,
          search: this.search,
          componentPagination: this.pagination,
          sort: '-updatedAt'
        })),
        switchMap(options => this.videoChannelService.listAccountVideoChannels(options))
      )
      .subscribe(res => {
        this.videoChannels = this.videoChannels.concat(res.data)
        this.pagination.totalItems = res.total

        // chart data
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

        this.onChannelDataSubject.next(res.data)
      })
  }

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

  getTotalTitle () {
    return formatICU(
      $localize`${this.pagination.totalItems} {total, plural, =1 {channel} other {channels}}`,
      { total: this.pagination.totalItems }
    )
  }
}
