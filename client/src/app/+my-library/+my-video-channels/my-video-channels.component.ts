import { ChartData, ChartOptions, TooltipItem, TooltipModel } from 'chart.js'
import { max, maxBy, min, minBy } from 'lodash-es'
import { Subject } from 'rxjs'
import { Component } from '@angular/core'
import { AuthService, ComponentPagination, ConfirmService, hasMoreItems, Notifier, ScreenService } from '@app/core'
import { VideoChannel, VideoChannelService } from '@app/shared/shared-main'

@Component({
  templateUrl: './my-video-channels.component.html',
  styleUrls: [ './my-video-channels.component.scss' ]
})
export class MyVideoChannelsComponent {
  totalItems: number

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

    this.authService.userInformationLoaded
      .subscribe(() => this.loadMoreVideoChannels())
  }

  async deleteVideoChannel (videoChannel: VideoChannel) {
    const res = await this.confirmService.confirmWithExpectedInput(
      $localize`Do you really want to delete ${videoChannel.displayName}?
It will delete ${videoChannel.videosCount} videos uploaded in this channel, and you will not be able to create another
channel or account with the same name (${videoChannel.name})!`,

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
    const user = this.authService.getUser()
    const options = {
      account: user.account,
      withStats: true,
      search: this.search,
      componentPagination: this.pagination,
      sort: '-updatedAt'
    }

    return this.videoChannelService.listAccountVideoChannels(options)
      .subscribe(res => {
        this.videoChannels = this.videoChannels.concat(res.data)
        this.totalItems = res.total

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
