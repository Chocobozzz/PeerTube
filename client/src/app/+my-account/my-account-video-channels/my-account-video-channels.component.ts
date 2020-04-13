import { Component, OnInit } from '@angular/core'
import { Notifier } from '@app/core'
import { AuthService } from '../../core/auth'
import { ConfirmService } from '../../core/confirm'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { ScreenService } from '@app/shared/misc/screen.service'
import { User } from '@app/shared'
import { flatMap } from 'rxjs/operators'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { min, minBy, max, maxBy } from 'lodash-es'
import { ChartData } from 'chart.js'

@Component({
  selector: 'my-account-video-channels',
  templateUrl: './my-account-video-channels.component.html',
  styleUrls: [ './my-account-video-channels.component.scss' ]
})
export class MyAccountVideoChannelsComponent implements OnInit {
  videoChannels: VideoChannel[] = []
  videoChannelsChartData: ChartData[]
  videoChannelsMinimumDailyViews = 0
  videoChannelsMaximumDailyViews: number

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

  async deleteVideoChannel (videoChannel: VideoChannel) {
    const res = await this.confirmService.confirmWithInput(
      this.i18n(
        // tslint:disable
        'Do you really want to delete {{channelDisplayName}}? It will delete all videos uploaded in this channel, and you will not be able to create another channel with the same name ({{channelName}})!',
        { channelDisplayName: videoChannel.displayName, channelName: videoChannel.name }
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
        .pipe(flatMap(() => this.videoChannelService.listAccountVideoChannels(this.user.account, null, true)))
        .subscribe(res => {
          this.videoChannels = res.data

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
