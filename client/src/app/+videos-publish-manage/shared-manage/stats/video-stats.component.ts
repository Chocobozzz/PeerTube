import { CommonModule } from '@angular/common'
import { Component, LOCALE_ID, OnInit, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { Notifier, PeerTubeRouterService, ServerService } from '@app/core'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { NumberFormatterPipe } from '@app/shared/shared-main/common/number-formatter.pipe'
import { LiveVideoService } from '@app/shared/shared-video-live/live-video.service'
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap'
import { secondsToTime } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  LiveVideoSession,
  VideoStatsOverall,
  VideoStatsRetention,
  VideoStatsTimeserie,
  VideoStatsTimeserieMetric,
  VideoStatsUserAgent
} from '@peertube/peertube-models'
import { ChartConfiguration, ChartData, defaults as ChartJSDefaults, ChartOptions, PluginOptionsByType, Scale, TooltipItem } from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'
import { ChartModule } from 'primeng/chart'
import { Observable, of } from 'rxjs'
import { SelectOptionsItem } from 'src/types'
import { SelectOptionsComponent } from '../../../shared/shared-forms/select/select-options.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { HelpComponent } from '../../../shared/shared-main/buttons/help.component'
import { EmbedComponent } from '../../../shared/shared-main/video/embed.component'
import { VideoEdit } from '../common/video-edit.model'
import { VideoManageController } from '../video-manage-controller.service'
import { VideoStatsService } from './video-stats.service'

const BAR_GRAPHS = [ 'countries', 'regions', 'clients', 'devices', 'operatingSystems' ] as const
type BarGraphs = typeof BAR_GRAPHS[number]
type ActiveGraphId = VideoStatsTimeserieMetric | 'retention' | BarGraphs

type GeoData = { name: string, viewers: number }[]

type ChartIngestData = VideoStatsTimeserie | VideoStatsRetention | GeoData | VideoStatsUserAgent
type ChartBuilderResult = {
  type: 'line' | 'bar'

  options?: ChartOptions<'bar'>

  plugins: Partial<PluginOptionsByType<'line' | 'bar'>>
  data: ChartData<'line' | 'bar'>
  displayLegend: boolean
}

type Card = { label: string, value: string | number, moreInfo?: string, help?: string }

const isBarGraph = (graphId: ActiveGraphId): graphId is BarGraphs => BAR_GRAPHS.some(graph => graph === graphId)

ChartJSDefaults.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--bg')
ChartJSDefaults.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary-500')
ChartJSDefaults.color = getComputedStyle(document.documentElement).getPropertyValue('--fg')

@Component({
  templateUrl: './video-stats.component.html',
  styleUrls: [
    '../common/video-manage-page-common.scss',
    './video-stats.component.scss'
  ],
  providers: [ NumberFormatterPipe ],
  imports: [
    CommonModule,
    HelpComponent,
    EmbedComponent,
    SelectOptionsComponent,
    FormsModule,
    NgbNavModule,
    ChartModule,
    ButtonComponent,
    GlobalIconComponent
  ]
})
export class VideoStatsComponent implements OnInit {
  private localeId = inject(LOCALE_ID)
  private route = inject(ActivatedRoute)
  private notifier = inject(Notifier)
  private statsService = inject(VideoStatsService)
  private peertubeRouter = inject(PeerTubeRouterService)
  private numberFormatter = inject(NumberFormatterPipe)
  private liveService = inject(LiveVideoService)
  private manageController = inject(VideoManageController)
  private serverService = inject(ServerService)

  // Cannot handle date filters
  globalStatsCards: Card[] = []
  // Can handle date filters
  overallStatCards: Card[] = []

  chartOptions: { [id in ActiveGraphId]?: ChartConfiguration<'line' | 'bar'> } = {}
  chartHeight = '300px'
  chartWidth: string = null

  availableCharts: { id: ActiveGraphId, label: string, zoomEnabled: boolean }[] = []
  activeGraphId: ActiveGraphId = 'viewers'

  videoEdit: VideoEdit

  countries: GeoData = []
  regions: GeoData = []

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

  private chartIngestData: { [id in ActiveGraphId]?: ChartIngestData } = {}

  ngOnInit () {
    this.videoEdit = this.manageController.getStore().videoEdit

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
      },
      {
        id: 'regions',
        label: $localize`Regions`,
        zoomEnabled: false
      },
      {
        id: 'clients',
        label: $localize`Clients`,
        zoomEnabled: false
      },
      {
        id: 'devices',
        label: $localize`Devices`,
        zoomEnabled: false
      },
      {
        id: 'operatingSystems',
        label: $localize`Operating systems`,
        zoomEnabled: false
      }
    ]

    if (!this.videoEdit.getVideoAttributes().isLive) {
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

      if (!this.statsStartDate && !this.statsEndDate) {
        this.currentDateFilter = 'all'
      }

      this.loadChart()
      this.loadOverallStats()
    })

    this.loadDateFilters()
  }

  hasCountries () {
    return this.countries.length !== 0
  }

  hasRegions () {
    return this.regions.length !== 0
  }

  onChartChange (newActive: ActiveGraphId) {
    this.activeGraphId = newActive

    if (newActive === 'countries') {
      this.chartHeight = `${Math.max(this.countries.length * 25, 300)}px`
    } else if (newActive === 'regions') {
      this.chartHeight = `${Math.max(this.regions.length * 25, 300)}px`
    } else {
      this.chartHeight = '300px'
    }

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
    const uuid = this.videoEdit.getVideoAttributes().uuid

    this.statsService.getOverallStats({ videoId: uuid, startDate: this.statsStartDate, endDate: this.statsEndDate })
      .subscribe({
        next: res => {
          this.countries = res.countries.map(c => ({
            name: this.countryCodeToName(c.isoCode),
            viewers: c.viewers
          }))

          this.regions = res.subdivisions

          this.buildOverallStatCard(res)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private loadDateFilters () {
    if (this.videoEdit.getVideoAttributes().isLive) return this.loadLiveDateFilters()

    return this.loadVODDateFilters()
  }

  private loadLiveDateFilters () {
    this.liveService.listSessions(this.videoEdit.getVideoAttributes().id)
      .subscribe({
        next: ({ data }) => {
          const newFilters = data.map(session => this.buildLiveFilter(session))

          this.dateFilters = this.dateFilters.concat(newFilters)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private loadVODDateFilters () {
    this.liveService.findLiveSessionFromVOD(this.videoEdit.getVideoAttributes().id)
      .subscribe({
        next: session => {
          this.dateFilters = this.dateFilters.concat([ this.buildLiveFilter(session) ])
        },

        error: err => {
          if (err.status === HttpStatusCode.NOT_FOUND_404) return

          this.notifier.handleError(err)
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
        value: this.numberFormatter.transform(this.videoEdit.getVideoAttributes().views),
        help: $localize`A view means that someone watched the video for several seconds (10 seconds by default)`
      },
      {
        label: $localize`Likes`,
        value: this.numberFormatter.transform(this.videoEdit.getVideoAttributes().likes)
      }
    ]

    this.overallStatCards = [
      {
        label: $localize`Average watch time`,
        value: secondsToTime({ seconds: overallStats.averageWatchTime, format: 'locale-string' })
      },
      {
        label: $localize`Total watch time`,
        value: secondsToTime({ seconds: overallStats.totalWatchTime, format: 'locale-string' })
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

    if (overallStats.subdivisions.length !== 0) {
      this.overallStatCards.push({
        label: $localize`Regions`,
        value: this.numberFormatter.transform(overallStats.subdivisions.length)
      })
    }
  }

  private loadChart () {
    const videoId = this.videoEdit.getVideoAttributes().uuid

    const obsBuilders: { [id in ActiveGraphId]: Observable<ChartIngestData> } = {
      retention: this.statsService.getRetentionStats(videoId),

      clients: this.statsService.getUserAgentStats({ videoId }),
      devices: this.statsService.getUserAgentStats({ videoId }),
      operatingSystems: this.statsService.getUserAgentStats({ videoId }),

      aggregateWatchTime: this.statsService.getTimeserieStats({
        videoId,
        startDate: this.statsStartDate,
        endDate: this.statsEndDate,
        metric: 'aggregateWatchTime'
      }),
      viewers: this.statsService.getTimeserieStats({
        videoId,
        startDate: this.statsStartDate,
        endDate: this.statsEndDate,
        metric: 'viewers'
      }),

      countries: of(this.countries),

      regions: of(this.regions)
    }

    obsBuilders[this.activeGraphId].subscribe({
      next: res => {
        this.chartIngestData[this.activeGraphId] = res

        this.chartOptions[this.activeGraphId] = this.buildChartOptions(this.activeGraphId)
      },

      error: err => this.notifier.handleError(err)
    })
  }

  private buildChartOptions (graphId: ActiveGraphId): ChartConfiguration<'line' | 'bar'> {
    const dataBuilders: {
      [id in ActiveGraphId]: (rawData: ChartIngestData) => ChartBuilderResult
    } = {
      clients: (rawData: VideoStatsUserAgent) => this.buildUserAgentChartOptions(rawData, 'clients'),
      devices: (rawData: VideoStatsUserAgent) => this.buildUserAgentChartOptions(rawData, 'devices'),
      operatingSystems: (rawData: VideoStatsUserAgent) => this.buildUserAgentChartOptions(rawData, 'operatingSystems'),
      retention: (rawData: VideoStatsRetention) => this.buildRetentionChartOptions(rawData),
      aggregateWatchTime: (rawData: VideoStatsTimeserie) => this.buildTimeserieChartOptions(rawData),
      viewers: (rawData: VideoStatsTimeserie) => this.buildTimeserieChartOptions(rawData),
      countries: (rawData: GeoData) => this.buildGeoChartOptions(rawData),
      regions: (rawData: GeoData) => this.buildGeoChartOptions(rawData)
    }

    const { type, data, displayLegend, plugins, options } = dataBuilders[graphId](this.chartIngestData[graphId])

    const self = this

    return {
      type,
      data,

      options: {
        ...options,

        responsive: true,

        scales: {
          x: {
            ticks: {
              stepSize: isBarGraph(graphId) ? 1 : undefined,
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
              callback: function (value) {
                return self.formatYTick({ graphId, value, scale: this })
              }
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
      data.push(Math.round(d.retentionPercent))
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
              const endDate = max === rawData.data.length - 1
                ? (this.statsEndDate || new Date()).toISOString()
                : rawData.data[max + 1].date

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

  private buildUserAgentChartOptions (rawData: VideoStatsUserAgent, type: 'clients' | 'devices' | 'operatingSystems'): ChartBuilderResult {
    const labels: string[] = []
    const data: number[] = []

    for (const d of rawData[type]) {
      const name = d.name?.charAt(0).toUpperCase() + d.name?.slice(1)
      labels.push(name)
      data.push(d.viewers)
    }

    return {
      type: 'bar' as 'bar',

      options: {
        indexAxis: 'y'
      },

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

  private buildGeoChartOptions (rawData: GeoData): ChartBuilderResult {
    const labels: string[] = []
    const data: number[] = []

    for (const d of rawData) {
      labels.push(d.name)
      data.push(d.viewers)
    }

    return {
      type: 'bar' as 'bar',

      options: {
        indexAxis: 'y'
      },

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
    return getComputedStyle(document.documentElement).getPropertyValue('--border-primary')
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

    if (data.groupInterval.match(/ months?$/)) {
      return date.toLocaleDateString([], { year: '2-digit', month: 'numeric' })
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
    scale?: Scale
  }) {
    const { graphId, value, scale } = options

    if (graphId === 'retention') return value + ' %'
    if (graphId === 'aggregateWatchTime') return secondsToTime(+value)
    if (isBarGraph(graphId) && scale) return scale.getLabelForValue(value as number)

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

  // ---------------------------------------------------------------------------

  hasMaxViewsAge () {
    return this.getMaxViewsAge() !== -1
  }

  getMaxViewsAgeDate () {
    return new Date(Date.now() - this.getMaxViewsAge())
  }

  private getMaxViewsAge () {
    return this.serverService.getHTMLConfig().views.videos.local.maxAge
  }
}
