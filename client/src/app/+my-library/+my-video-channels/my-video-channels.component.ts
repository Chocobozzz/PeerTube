import { ChartData, ChartOptions, TooltipItem, TooltipModel } from 'chart.js'
import { max, maxBy, min, minBy } from 'lodash-es'
import { Subject, first, map, switchMap } from 'rxjs'
import { Component } from '@angular/core'
import { AuthService, ComponentPagination, ConfirmService, hasMoreItems, Notifier, ScreenService } from '@app/core'
import { formatICU } from '@app/helpers'
import { NumberFormatterPipe } from '../../shared/shared-main/angular/number-formatter.pipe'
import { ChartModule } from 'primeng/chart'
import { DeferLoadingDirective } from '../../shared/shared-main/angular/defer-loading.directive'
import { DeleteButtonComponent } from '../../shared/shared-main/buttons/delete-button.component'
import { EditButtonComponent } from '../../shared/shared-main/buttons/edit-button.component'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { InfiniteScrollerDirective } from '../../shared/shared-main/angular/infinite-scroller.directive'
import { AdvancedInputFilterComponent } from '../../shared/shared-forms/advanced-input-filter.component'
import { ChannelsSetupMessageComponent } from '../../shared/shared-main/misc/channels-setup-message.component'
import { RouterLink } from '@angular/router'
import { NgIf, NgFor } from '@angular/common'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { VideoChannel } from '@app/shared/shared-main/video-channel/video-channel.model'
import { VideoChannelService } from '@app/shared/shared-main/video-channel/video-channel.service'

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

  videoChannelsChartData: ChartData[]

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

    this.pagination.currentPage = 1
    this.videoChannels = []

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
          ]
        } as ChartData))

        this.buildChartOptions()

        this.onChannelDataSubject.next(res.data)
      })
  }

  private buildChartOptions () {
    // chart options that depend on chart data:
    // we don't want to skew values and have min at 0, so we define what the floor/ceiling is here
    const videoChannelsMinimumDailyViews = min(
      // compute local minimum daily views for each channel, by their "views" attribute
      this.videoChannels.map(v => minBy(
        v.viewsPerDay,
        day => day.views
      ).views) // the object returned is a ViewPerDate, so we still need to get the views attribute
    )

    const videoChannelsMaximumDailyViews = max(
      // compute local maximum daily views for each channel, by their "views" attribute
      this.videoChannels.map(v => maxBy(
        v.viewsPerDay,
        day => day.views
      ).views) // the object returned is a ViewPerDate, so we still need to get the views attribute
    )

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
          min: Math.max(0, videoChannelsMinimumDailyViews - (3 * videoChannelsMaximumDailyViews / 100)),
          max: Math.max(1, videoChannelsMaximumDailyViews)
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
}
