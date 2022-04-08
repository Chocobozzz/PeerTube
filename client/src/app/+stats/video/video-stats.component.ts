import { ChartConfiguration, ChartData, PluginOptionsByType, Scale, TooltipItem } from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'
import { Observable, of } from 'rxjs'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { Notifier, PeerTubeRouterService } from '@app/core'
import { NumberFormatterPipe, VideoDetails } from '@app/shared/shared-main'
import { secondsToTime } from '@shared/core-utils'
import { VideoStatsOverall, VideoStatsRetention, VideoStatsTimeserie, VideoStatsTimeserieMetric } from '@shared/models/videos'
import { VideoStatsService } from './video-stats.service'

type ActiveGraphId = VideoStatsTimeserieMetric | 'retention' | 'countries'

type CountryData = { name: string, viewers: number }[]

type ChartIngestData = VideoStatsTimeserie | VideoStatsRetention | CountryData
type ChartBuilderResult = {
  type: 'line' | 'bar'
  plugins: Partial<PluginOptionsByType<'line' | 'bar'>>
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
      label: $localize`Viewers`,
      zoomEnabled: true
    },
    {
      id: 'aggregateWatchTime',
      label: $localize`Watch time`,
      zoomEnabled: true
    },
    {
      id: 'retention',
      label: $localize`Retention`,
      zoomEnabled: false
    },
    {
      id: 'countries',
      label: $localize`Countries`,
      zoomEnabled: false
    }
  ]

  activeGraphId: ActiveGraphId = 'viewers'

  video: VideoDetails

  countries: CountryData = []

  chartPlugins = [ zoomPlugin ]

  private timeseriesStartDate: Date
  private timeseriesEndDate: Date

  private chartIngestData: { [ id in ActiveGraphId ]?: ChartIngestData } = {}

  constructor (
    private route: ActivatedRoute,
    private notifier: Notifier,
    private statsService: VideoStatsService,
    private peertubeRouter: PeerTubeRouterService,
    private numberFormatter: NumberFormatterPipe
  ) {}

  ngOnInit () {
    this.video = this.route.snapshot.data.video

    this.route.queryParams.subscribe(params => {
      this.timeseriesStartDate = params.startDate
        ? new Date(params.startDate)
        : undefined

      this.timeseriesEndDate = params.endDate
        ? new Date(params.endDate)
        : undefined

      this.loadChart()
    })

    this.loadOverallStats()
  }

  hasCountries () {
    return this.countries.length !== 0
  }

  onChartChange (newActive: ActiveGraphId) {
    this.activeGraphId = newActive

    this.loadChart()
  }

  resetZoom () {
    this.peertubeRouter.silentNavigate([], {})
  }

  hasZoom () {
    return !!this.timeseriesStartDate && this.isTimeserieGraph(this.activeGraphId)
  }

  private isTimeserieGraph (graphId: ActiveGraphId) {
    return graphId === 'aggregateWatchTime' || graphId === 'viewers'
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

      aggregateWatchTime: this.statsService.getTimeserieStats({
        videoId: this.video.uuid,
        startDate: this.timeseriesStartDate,
        endDate: this.timeseriesEndDate,
        metric: 'aggregateWatchTime'
      }),
      viewers: this.statsService.getTimeserieStats({
        videoId: this.video.uuid,
        startDate: this.timeseriesStartDate,
        endDate: this.timeseriesEndDate,
        metric: 'viewers'
      }),

      countries: of(this.countries)
    }

    obsBuilders[this.activeGraphId].subscribe({
      next: res => {
        this.chartIngestData[this.activeGraphId] = res

        this.chartOptions[this.activeGraphId] = this.buildChartOptions(this.activeGraphId)
      },

      error: err => this.notifier.error(err.message)
    })
  }

  private buildChartOptions (graphId: ActiveGraphId): ChartConfiguration<'line' | 'bar'> {
    const dataBuilders: {
      [ id in ActiveGraphId ]: (rawData: ChartIngestData) => ChartBuilderResult
    } = {
      retention: (rawData: VideoStatsRetention) => this.buildRetentionChartOptions(rawData),
      aggregateWatchTime: (rawData: VideoStatsTimeserie) => this.buildTimeserieChartOptions(rawData),
      viewers: (rawData: VideoStatsTimeserie) => this.buildTimeserieChartOptions(rawData),
      countries: (rawData: CountryData) => this.buildCountryChartOptions(rawData)
    }

    const { type, data, displayLegend, plugins } = dataBuilders[graphId](this.chartIngestData[graphId])

    const self = this

    return {
      type,
      data,

      options: {
        responsive: true,

        scales: {
          x: {
            ticks: {
              callback: function (value) {
                return self.formatXTick({
                  graphId,
                  value,
                  data: self.chartIngestData[graphId] as VideoStatsTimeserie,
                  scale: this
                })
              }
            }
          },

          y: {
            beginAtZero: true,

            max: this.activeGraphId === 'retention'
              ? 100
              : undefined,

            ticks: {
              callback: value => this.formatYTick({ graphId, value })
            }
          }
        },

        plugins: {
          legend: {
            display: displayLegend
          },
          tooltip: {
            callbacks: {
              title: items => this.formatTooltipTitle({ graphId, items }),
              label: value => this.formatYTick({ graphId, value: value.raw as number | string })
            }
          },

          ...plugins
        }
      }
    }
  }

  private buildRetentionChartOptions (rawData: VideoStatsRetention): ChartBuilderResult {
    const labels: string[] = []
    const data: number[] = []

    for (const d of rawData.data) {
      labels.push(secondsToTime(d.second))
      data.push(d.retentionPercent)
    }

    return {
      type: 'line' as 'line',

      displayLegend: false,

      plugins: {
        ...this.buildDisabledZoomPlugin()
      },

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

  private buildTimeserieChartOptions (rawData: VideoStatsTimeserie): ChartBuilderResult {
    const labels: string[] = []
    const data: number[] = []

    for (const d of rawData.data) {
      labels.push(d.date)
      data.push(d.value)
    }

    return {
      type: 'line' as 'line',

      displayLegend: false,

      plugins: {
        zoom: {
          zoom: {
            wheel: {
              enabled: false
            },
            drag: {
              enabled: true
            },
            pinch: {
              enabled: true
            },
            mode: 'x',
            onZoomComplete: ({ chart }) => {
              const { min, max } = chart.scales.x

              const startDate = rawData.data[min].date
              const endDate = rawData.data[max].date

              this.peertubeRouter.silentNavigate([], { startDate, endDate })
            }
          }
        }
      },

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

  private buildCountryChartOptions (rawData: CountryData): ChartBuilderResult {
    const labels: string[] = []
    const data: number[] = []

    for (const d of rawData) {
      labels.push(d.name)
      data.push(d.viewers)
    }

    return {
      type: 'bar' as 'bar',

      displayLegend: true,

      plugins: {
        ...this.buildDisabledZoomPlugin()
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

  private formatXTick (options: {
    graphId: ActiveGraphId
    value: number | string
    data: VideoStatsTimeserie
    scale: Scale
  }) {
    const { graphId, value, data, scale } = options

    const label = scale.getLabelForValue(value as number)

    if (!this.isTimeserieGraph(graphId)) {
      return label
    }

    const date = new Date(label)

    if (data.groupInterval.match(/ days?$/)) {
      return date.toLocaleDateString([], { month: 'numeric', day: 'numeric' })
    }

    if (data.groupInterval.match(/ hours?$/)) {
      return date.toLocaleTimeString([], { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
    }

    return date.toLocaleTimeString([], { hour: 'numeric', minute: 'numeric' })
  }

  private formatYTick (options: {
    graphId: ActiveGraphId
    value: number | string
  }) {
    const { graphId, value } = options

    if (graphId === 'retention') return value + ' %'
    if (graphId === 'aggregateWatchTime') return secondsToTime(+value)

    return value.toLocaleString()
  }

  private formatTooltipTitle (options: {
    graphId: ActiveGraphId
    items: TooltipItem<any>[]
  }) {
    const { graphId, items } = options
    const item = items[0]

    if (this.isTimeserieGraph(graphId)) return new Date(item.label).toLocaleString()

    return item.label
  }

  private countryCodeToName (code: string) {
    const intl: any = Intl
    if (!intl.DisplayNames) return code

    const regionNames = new intl.DisplayNames([], { type: 'region' })

    return regionNames.of(code)
  }

  private buildDisabledZoomPlugin () {
    return {
      zoom: {
        zoom: {
          wheel: {
            enabled: false
          },
          drag: {
            enabled: false
          },
          pinch: {
            enabled: false
          }
        }
      }
    }
  }
}
