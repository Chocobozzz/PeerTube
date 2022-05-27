import { ChartConfiguration, ChartData, PluginOptionsByType, Scale, TooltipItem } from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'
import { Observable, of } from 'rxjs'
import { SelectOptionsItem } from 'src/types'
import { Component, Inject, LOCALE_ID, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { Notifier, PeerTubeRouterService } from '@app/core'
import { NumberFormatterPipe, VideoDetails } from '@app/shared/shared-main'
import { LiveVideoService } from '@app/shared/shared-video-live'
import { secondsToTime } from '@shared/core-utils'
import { HttpStatusCode } from '@shared/models/http'
import {
  LiveVideoSession,
  VideoStatsOverall,
  VideoStatsRetention,
  VideoStatsTimeserie,
  VideoStatsTimeserieMetric
} from '@shared/models/videos'
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

type Card = { label: string, value: string | number, moreInfo?: string, help?: string }

@Component({
  templateUrl: './video-stats.component.html',
  styleUrls: [ './video-stats.component.scss' ],
  providers: [ NumberFormatterPipe ]
})
export class VideoStatsComponent implements OnInit {
  // Cannot handle date filters
  globalStatsCards: Card[] = []
  // Can handle date filters
  overallStatCards: Card[] = []

  chartOptions: { [ id in ActiveGraphId ]?: ChartConfiguration<'line' | 'bar'> } = {}
  chartHeight = '300px'
  chartWidth: string = null

  availableCharts: { id: string, label: string, zoomEnabled: boolean }[] = []
  activeGraphId: ActiveGraphId = 'viewers'

  video: VideoDetails

  countries: CountryData = []

  chartPlugins = [ zoomPlugin ]

  currentDateFilter = 'all'
  dateFilters: SelectOptionsItem[] = [
    {
      id: 'all',
      label: $localize`Since the video publication`
    }
  ]

  private statsStartDate: Date
  private statsEndDate: Date

  private chartIngestData: { [ id in ActiveGraphId ]?: ChartIngestData } = {}

  constructor (
    @Inject(LOCALE_ID) private localeId: string,
    private route: ActivatedRoute,
    private notifier: Notifier,
    private statsService: VideoStatsService,
    private peertubeRouter: PeerTubeRouterService,
    private numberFormatter: NumberFormatterPipe,
    private liveService: LiveVideoService
  ) {}

  ngOnInit () {
    this.video = this.route.snapshot.data.video

    this.availableCharts = [
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
        id: 'countries',
        label: $localize`Countries`,
        zoomEnabled: false
      }
    ]

    if (!this.video.isLive) {
      this.availableCharts.push({
        id: 'retention',
        label: $localize`Retention`,
        zoomEnabled: false
      })
    }

    const snapshotQuery = this.route.snapshot.queryParams
    if (snapshotQuery.startDate || snapshotQuery.endDate) {
      this.addAndSelectCustomDateFilter()
    }

    this.route.queryParams.subscribe(params => {
      this.statsStartDate = params.startDate
        ? new Date(params.startDate)
        : undefined

      this.statsEndDate = params.endDate
        ? new Date(params.endDate)
        : undefined

      this.loadChart()
      this.loadOverallStats()
    })

    this.loadDateFilters()
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
    this.removeAndResetCustomDateFilter()
  }

  hasZoom () {
    return !!this.statsStartDate && this.isTimeserieGraph(this.activeGraphId)
  }

  getViewersStatsTitle () {
    if (this.statsStartDate && this.statsEndDate) {
      return $localize`Viewers stats between ${this.toMediumDate(this.statsStartDate)} and ${this.toMediumDate(this.statsEndDate)}`
    }

    return $localize`Viewers stats`
  }

  onDateFilterChange () {
    if (this.currentDateFilter === 'all') {
      return this.resetZoom()
    }

    const idParts = this.currentDateFilter.split('|')
    if (idParts.length === 2) {
      return this.peertubeRouter.silentNavigate([], { startDate: idParts[0], endDate: idParts[1] })
    }
  }

  private isTimeserieGraph (graphId: ActiveGraphId) {
    return graphId === 'aggregateWatchTime' || graphId === 'viewers'
  }

  private loadOverallStats () {
    this.statsService.getOverallStats({ videoId: this.video.uuid, startDate: this.statsStartDate, endDate: this.statsEndDate })
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

  private loadDateFilters () {
    if (this.video.isLive) return this.loadLiveDateFilters()

    return this.loadVODDateFilters()
  }

  private loadLiveDateFilters () {
    this.liveService.listSessions(this.video.id)
      .subscribe({
        next: ({ data }) => {
          const newFilters = data.map(session => this.buildLiveFilter(session))

          this.dateFilters = this.dateFilters.concat(newFilters)
        },

        error: err => this.notifier.error(err.message)
      })
  }

  private loadVODDateFilters () {
    this.liveService.findLiveSessionFromVOD(this.video.id)
      .subscribe({
        next: session => {
          this.dateFilters = this.dateFilters.concat([ this.buildLiveFilter(session) ])
        },

        error: err => {
          if (err.status === HttpStatusCode.NOT_FOUND_404) return

          this.notifier.error(err.message)
        }
      })
  }

  private buildLiveFilter (session: LiveVideoSession) {
    return {
      id: session.startDate + '|' + session.endDate,
      label: $localize`Live as of ${this.toMediumDate(new Date(session.startDate))}`
    }
  }

  private addAndSelectCustomDateFilter () {
    const exists = this.dateFilters.some(d => d.id === 'custom')

    if (!exists) {
      this.dateFilters = this.dateFilters.concat([
        {
          id: 'custom',
          label: $localize`Custom dates`
        }
      ])
    }

    this.currentDateFilter = 'custom'
  }

  private removeAndResetCustomDateFilter () {
    this.dateFilters = this.dateFilters.filter(d => d.id !== 'custom')

    this.currentDateFilter = 'all'
  }

  private buildOverallStatCard (overallStats: VideoStatsOverall) {
    this.globalStatsCards = [
      {
        label: $localize`Views`,
        value: this.numberFormatter.transform(this.video.views),
        help: $localize`A view means that someone watched the video for at least 30 seconds`
      },
      {
        label: $localize`Likes`,
        value: this.numberFormatter.transform(this.video.likes)
      }
    ]

    this.overallStatCards = [
      {
        label: $localize`Average watch time`,
        value: secondsToTime(overallStats.averageWatchTime)
      },
      {
        label: $localize`Total watch time`,
        value: secondsToTime(overallStats.totalWatchTime)
      },
      {
        label: $localize`Peak viewers`,
        value: this.numberFormatter.transform(overallStats.viewersPeak),
        moreInfo: overallStats.viewersPeak !== 0
          ? $localize`at ${this.toMediumDate(new Date(overallStats.viewersPeakDate))}`
          : undefined
      },
      {
        label: $localize`Unique viewers`,
        value: this.numberFormatter.transform(overallStats.totalViewers)
      }
    ]

    if (overallStats.countries.length !== 0) {
      this.overallStatCards.push({
        label: $localize`Countries`,
        value: this.numberFormatter.transform(overallStats.countries.length)
      })
    }
  }

  private loadChart () {
    const obsBuilders: { [ id in ActiveGraphId ]: Observable<ChartIngestData> } = {
      retention: this.statsService.getRetentionStats(this.video.uuid),

      aggregateWatchTime: this.statsService.getTimeserieStats({
        videoId: this.video.uuid,
        startDate: this.statsStartDate,
        endDate: this.statsEndDate,
        metric: 'aggregateWatchTime'
      }),
      viewers: this.statsService.getTimeserieStats({
        videoId: this.video.uuid,
        startDate: this.statsStartDate,
        endDate: this.statsEndDate,
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
              const endDate = this.buildZoomEndDate(rawData.groupInterval, rawData.data[max].date)

              this.peertubeRouter.silentNavigate([], { startDate, endDate })
              this.addAndSelectCustomDateFilter()
            }
          },
          limits: {
            x: {
              minRange: 2
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

    if (data.groupInterval.match(/ month?$/)) {
      return date.toLocaleDateString([], { month: 'numeric' })
    }

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

    return value.toLocaleString(this.localeId)
  }

  private formatTooltipTitle (options: {
    graphId: ActiveGraphId
    items: TooltipItem<any>[]
  }) {
    const { graphId, items } = options
    const item = items[0]

    if (this.isTimeserieGraph(graphId)) {
      return this.toMediumDate(new Date(item.label))
    }

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

  private toMediumDate (d: Date) {
    return new Date(d).toLocaleString(this.localeId, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    })
  }

  private buildZoomEndDate (groupInterval: string, last: string) {
    const date = new Date(last)

    // Remove parts of the date we don't need
    if (groupInterval.endsWith(' day') || groupInterval.endsWith(' days')) {
      date.setHours(23, 59, 59)
    } else if (groupInterval.endsWith(' hour') || groupInterval.endsWith(' hours')) {
      date.setMinutes(59, 59)
    } else {
      date.setSeconds(59)
    }

    return date.toISOString()
  }
}
