import { ChartConfiguration, ChartData } from 'chart.js'
import { Observable, of } from 'rxjs'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { Notifier } from '@app/core'
import { NumberFormatterPipe, VideoDetails } from '@app/shared/shared-main'
import { secondsToTime } from '@shared/core-utils'
import { VideoStatsOverall, VideoStatsRetention, VideoStatsTimeserie, VideoStatsTimeserieMetric } from '@shared/models/videos'
import { VideoStatsService } from './video-stats.service'

type ActiveGraphId = VideoStatsTimeserieMetric | 'retention' | 'countries'

type CountryData = { name: string, viewers: number }[]

type ChartIngestData = VideoStatsTimeserie | VideoStatsRetention | CountryData
type ChartBuilderResult = {
  type: 'line' | 'bar'
  data: ChartData<'line' | 'bar'>
  displayLegend: boolean
}

@Component({
  templateUrl: './video-stats.component.html',
  styleUrls: [ './video-stats.component.scss' ],
  providers: [ NumberFormatterPipe ]
})
export class VideoStatsComponent implements OnInit {
  overallStatCards: { label: string, value: string | number, moreInfo?: string }[] = []

  chartOptions: { [ id in ActiveGraphId ]?: ChartConfiguration<'line' | 'bar'> } = {}
  chartHeight = '300px'
  chartWidth: string = null

  availableCharts = [
    {
      id: 'viewers',
      label: $localize`Viewers`
    },
    {
      id: 'aggregateWatchTime',
      label: $localize`Watch time`
    },
    {
      id: 'retention',
      label: $localize`Retention`
    },
    {
      id: 'countries',
      label: $localize`Countries`
    }
  ]

  activeGraphId: ActiveGraphId = 'viewers'

  video: VideoDetails

  countries: CountryData = []

  constructor (
    private route: ActivatedRoute,
    private notifier: Notifier,
    private statsService: VideoStatsService,
    private numberFormatter: NumberFormatterPipe
  ) {}

  ngOnInit () {
    this.video = this.route.snapshot.data.video

    this.loadOverallStats()
    this.loadChart()
  }

  hasCountries () {
    return this.countries.length !== 0
  }

  onChartChange (newActive: ActiveGraphId) {
    this.activeGraphId = newActive

    this.loadChart()
  }

  private loadOverallStats () {
    this.statsService.getOverallStats(this.video.uuid)
      .subscribe({
        next: res => {
          this.countries = res.countries.slice(0, 10).map(c => ({
            name: this.countryCodeToName(c.isoCode),
            viewers: c.viewers
          }))

          this.buildOverallStatCard(res)
        },

        error: err => this.notifier.error(err.message)
      })
  }

  private buildOverallStatCard (overallStats: VideoStatsOverall) {
    this.overallStatCards = [
      {
        label: $localize`Views`,
        value: this.numberFormatter.transform(overallStats.views)
      },
      {
        label: $localize`Comments`,
        value: this.numberFormatter.transform(overallStats.comments)
      },
      {
        label: $localize`Likes`,
        value: this.numberFormatter.transform(overallStats.likes)
      },
      {
        label: $localize`Average watch time`,
        value: secondsToTime(overallStats.averageWatchTime)
      },
      {
        label: $localize`Peak viewers`,
        value: this.numberFormatter.transform(overallStats.viewersPeak),
        moreInfo: $localize`at ${new Date(overallStats.viewersPeakDate).toLocaleString()}`
      }
    ]
  }

  private loadChart () {
    const obsBuilders: { [ id in ActiveGraphId ]: Observable<ChartIngestData> } = {
      retention: this.statsService.getRetentionStats(this.video.uuid),
      aggregateWatchTime: this.statsService.getTimeserieStats(this.video.uuid, 'aggregateWatchTime'),
      viewers: this.statsService.getTimeserieStats(this.video.uuid, 'viewers'),
      countries: of(this.countries)
    }

    obsBuilders[this.activeGraphId].subscribe({
      next: res => {
        this.chartOptions[this.activeGraphId] = this.buildChartOptions(this.activeGraphId, res)
      },

      error: err => this.notifier.error(err.message)
    })
  }

  private buildChartOptions (
    graphId: ActiveGraphId,
    rawData: ChartIngestData
  ): ChartConfiguration<'line' | 'bar'> {
    const dataBuilders: {
      [ id in ActiveGraphId ]: (rawData: ChartIngestData) => ChartBuilderResult
    } = {
      retention: (rawData: VideoStatsRetention) => this.buildRetentionChartOptions(rawData),
      aggregateWatchTime: (rawData: VideoStatsTimeserie) => this.buildTimeserieChartOptions(rawData),
      viewers: (rawData: VideoStatsTimeserie) => this.buildTimeserieChartOptions(rawData),
      countries: (rawData: CountryData) => this.buildCountryChartOptions(rawData)
    }

    const { type, data, displayLegend } = dataBuilders[graphId](rawData)

    return {
      type,
      data,

      options: {
        responsive: true,

        scales: {
          y: {
            beginAtZero: true,

            max: this.activeGraphId === 'retention'
              ? 100
              : undefined,

            ticks: {
              callback: value => this.formatTick(graphId, value)
            }
          }
        },

        plugins: {
          legend: {
            display: displayLegend
          },
          tooltip: {
            callbacks: {
              label: value => this.formatTick(graphId, value.raw as number | string)
            }
          }
        }
      }
    }
  }

  private buildRetentionChartOptions (rawData: VideoStatsRetention) {
    const labels: string[] = []
    const data: number[] = []

    for (const d of rawData.data) {
      labels.push(secondsToTime(d.second))
      data.push(d.retentionPercent)
    }

    return {
      type: 'line' as 'line',

      displayLegend: false,

      data: {
        labels,
        datasets: [
          {
            data,
            borderColor: this.buildChartColor()
          }
        ]
      }
    }
  }

  private buildTimeserieChartOptions (rawData: VideoStatsTimeserie) {
    const labels: string[] = []
    const data: number[] = []

    for (const d of rawData.data) {
      labels.push(new Date(d.date).toLocaleDateString())
      data.push(d.value)
    }

    return {
      type: 'line' as 'line',

      displayLegend: false,

      data: {
        labels,
        datasets: [
          {
            data,
            borderColor: this.buildChartColor()
          }
        ]
      }
    }
  }

  private buildCountryChartOptions (rawData: CountryData) {
    const labels: string[] = []
    const data: number[] = []

    for (const d of rawData) {
      labels.push(d.name)
      data.push(d.viewers)
    }

    return {
      type: 'bar' as 'bar',

      displayLegend: true,

      options: {
        indexAxis: 'y'
      },

      data: {
        labels,
        datasets: [
          {
            label: $localize`Viewers`,
            backgroundColor: this.buildChartColor(),
            maxBarThickness: 20,
            data
          }
        ]
      }
    }
  }

  private buildChartColor () {
    return getComputedStyle(document.body).getPropertyValue('--mainColorLighter')
  }

  private formatTick (graphId: ActiveGraphId, value: number | string) {
    if (graphId === 'retention') return value + ' %'
    if (graphId === 'aggregateWatchTime') return secondsToTime(+value)

    return value.toLocaleString()
  }

  private countryCodeToName (code: string) {
    const intl: any = Intl
    if (!intl.DisplayNames) return code

    const regionNames = new intl.DisplayNames([], { type: 'region' })

    return regionNames.of(code)
  }
}
