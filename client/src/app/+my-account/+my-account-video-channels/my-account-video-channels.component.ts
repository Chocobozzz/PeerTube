import { ChartData } from 'chart.js'
import { max, maxBy, min, minBy } from 'lodash-es'
import { flatMap, debounceTime } from 'rxjs/operators'
import { Component, OnInit } from '@angular/core'
import { AuthService, ConfirmService, Notifier, ScreenService, User } from '@app/core'
import { VideoChannel, VideoChannelService } from '@app/shared/shared-main'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { Subject } from 'rxjs'

@Component({
  selector: 'my-account-video-channels',
  templateUrl: './my-account-video-channels.component.html',
  styleUrls: [ './my-account-video-channels.component.scss' ]
})
export class MyAccountVideoChannelsComponent implements OnInit {
  totalItems: number

  videoChannels: VideoChannel[] = []
  videoChannelsChartData: ChartData[]
  videoChannelsMinimumDailyViews = 0
  videoChannelsMaximumDailyViews: number

  channelsSearch: string
  channelsSearchChanged = new Subject<string>()

  private user: User

  constructor (
    private authService: AuthService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private videoChannelService: VideoChannelService,
    private screenService: ScreenService,
    private i18n: I18n
  ) {}

  ngOnInit () {
    this.user = this.authService.getUser()

    this.loadVideoChannels()

    this.channelsSearchChanged
      .pipe(debounceTime(500))
      .subscribe(() => {
        this.loadVideoChannels()
      })
  }

  get isInSmallView () {
    return this.screenService.isInSmallView()
  }

  get chartOptions () {
    return {
      legend: {
        display: false
      },
      scales: {
        xAxes: [{
          display: false
        }],
        yAxes: [{
          display: false,
          ticks: {
            min: Math.max(0, this.videoChannelsMinimumDailyViews - (3 * this.videoChannelsMaximumDailyViews / 100)),
            max: Math.max(1, this.videoChannelsMaximumDailyViews)
          }
        }]
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
      tooltips: {
        mode: 'index',
        intersect: false,
        custom: function (tooltip: any) {
          if (!tooltip) return
          // disable displaying the color box
          tooltip.displayColors = false
        },
        callbacks: {
          label: (tooltip: any, data: any) => `${tooltip.value} views`
        }
      },
      hover: {
        mode: 'index',
        intersect: false
      }
    }
  }

  resetSearch () {
    this.channelsSearch = ''
    this.onChannelsSearchChanged()
  }

  onChannelsSearchChanged () {
    this.channelsSearchChanged.next()
  }

  async deleteVideoChannel (videoChannel: VideoChannel) {
    const res = await this.confirmService.confirmWithInput(
      this.i18n(
        // tslint:disable
        'Do you really want to delete {{channelDisplayName}}? It will delete {{videosCount}} videos uploaded in this channel, and you will not be able to create another channel with the same name ({{channelName}})!',
        { channelDisplayName: videoChannel.displayName, videosCount: videoChannel.videosCount, channelName: videoChannel.name }
      ),
      this.i18n(
        'Please type the display name of the video channel ({{displayName}}) to confirm',
        { displayName: videoChannel.displayName }
      ),
      videoChannel.displayName,
      this.i18n('Delete')
    )
    if (res === false) return

    this.videoChannelService.removeVideoChannel(videoChannel)
      .subscribe(
        () => {
          this.loadVideoChannels()
          this.notifier.success(
            this.i18n('Video channel {{videoChannelName}} deleted.', { videoChannelName: videoChannel.displayName })
          )
        },

        error => this.notifier.error(error.message)
      )
  }

  private loadVideoChannels () {
    this.authService.userInformationLoaded
        .pipe(flatMap(() => this.videoChannelService.listAccountVideoChannels(this.user.account, null, true, this.channelsSearch)))
        .subscribe(res => {
          this.videoChannels = res.data
          this.totalItems = res.total

          // chart data
          this.videoChannelsChartData = this.videoChannels.map(v => ({
            labels: v.viewsPerDay.map(day => day.date.toLocaleDateString()),
            datasets: [
              {
                  label: this.i18n('Views for the day'),
                  data: v.viewsPerDay.map(day => day.views),
                  fill: false,
                  borderColor: "#c6c6c6"
              }
            ]
          } as ChartData))

          // chart options that depend on chart data:
          // we don't want to skew values and have min at 0, so we define what the floor/ceiling is here
          this.videoChannelsMinimumDailyViews = min(
            this.videoChannels.map(v => minBy( // compute local minimum daily views for each channel, by their "views" attribute
              v.viewsPerDay,
              day => day.views
            ).views) // the object returned is a ViewPerDate, so we still need to get the views attribute
          )
          this.videoChannelsMaximumDailyViews = max(
            this.videoChannels.map(v => maxBy( // compute local maximum daily views for each channel, by their "views" attribute
              v.viewsPerDay,
              day => day.views
            ).views) // the object returned is a ViewPerDate, so we still need to get the views attribute
          )
        })
  }
}
