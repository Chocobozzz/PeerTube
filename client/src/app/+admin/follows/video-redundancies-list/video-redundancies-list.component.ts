import { Component, OnInit, inject, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ConfirmService, Notifier, ServerService } from '@app/core'
import { BytesPipe } from '@app/shared/shared-main/common/bytes.pipe'
import { RedundancyService } from '@app/shared/shared-main/video/redundancy.service'
import { VideoRedundanciesTarget, VideoRedundancy, VideosRedundancyStats } from '@peertube/peertube-models'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { ChartData, ChartOptions, TooltipItem } from 'chart.js'
import { ChartModule } from 'primeng/chart'
import { tap } from 'rxjs'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { DeleteButtonComponent } from '../../../shared/shared-main/buttons/delete-button.component'
import { NumberFormatterPipe } from '../../../shared/shared-main/common/number-formatter.pipe'
import { DataLoaderOptions, TableColumnInfo, TableComponent, TableQueryParams } from '../../../shared/shared-tables/table.component'
import { VideoRedundancyInformationComponent } from './video-redundancy-information.component'

type QueryParams = TableQueryParams & {
  displayType: VideoRedundanciesTarget
}

@Component({
  selector: 'my-video-redundancies-list',
  templateUrl: './video-redundancies-list.component.html',
  styleUrls: [ './video-redundancies-list.component.scss' ],
  imports: [
    GlobalIconComponent,
    FormsModule,
    DeleteButtonComponent,
    VideoRedundancyInformationComponent,
    ChartModule,
    BytesPipe,
    TableComponent,
    NumberFormatterPipe
  ]
})
export class VideoRedundanciesListComponent implements OnInit {
  private static LS_DISPLAY_TYPE = 'video-redundancies-list-display-type'

  private notifier = inject(Notifier)
  private confirmService = inject(ConfirmService)
  private redundancyService = inject(RedundancyService)
  private serverService = inject(ServerService)

  readonly table = viewChild<TableComponent<VideoRedundancy>>('table')

  displayType: VideoRedundanciesTarget = 'my-videos'

  redundanciesGraphsData: { stats: VideosRedundancyStats, graphData: ChartData, options: ChartOptions, ariaLabel: string }[] = []

  noRedundancies = false

  // Prevent layout shift for redundancy stats
  dataLoaded = false

  private bytesPipe: BytesPipe

  columns: TableColumnInfo<string>[]

  dataLoader: typeof this._dataLoader
  customUpdateUrl: typeof this._customUpdateUrl
  customParseQueryParams: typeof this._customParseQueryParams

  constructor () {
    this.bytesPipe = new BytesPipe()
    this.customUpdateUrl = this._customUpdateUrl.bind(this)
    this.customParseQueryParams = this._customParseQueryParams.bind(this)
    this.dataLoader = this._dataLoader.bind(this)
  }

  ngOnInit () {
    this.loadSelectLocalStorage()
    this.buildColumns()

    this.serverService.getServerStats()
      .subscribe(res => {
        const redundancies = res.videosRedundancy

        if (redundancies.length === 0) this.noRedundancies = true

        for (const r of redundancies) {
          this.buildPieData(r)
        }
      })
  }

  isDisplayingRemoteVideos () {
    return this.displayType === 'remote-videos'
  }

  getTotalSize (redundancy: VideoRedundancy) {
    return redundancy.redundancies.streamingPlaylists.reduce((a, b) => a + b.size, 0)
  }

  onDisplayTypeChanged () {
    this.dataLoaded = false

    this.saveSelectLocalStorage()
    this.buildColumns()

    this.table().reloadData()
  }

  getRedundancyStrategy (redundancy: VideoRedundancy) {
    if (redundancy.redundancies.streamingPlaylists.length !== 0) {
      return redundancy.redundancies.streamingPlaylists[0].strategy
    }

    return ''
  }

  buildPieData (stats: VideosRedundancyStats) {
    if (stats.totalSize === 0) return

    const totalAvailable = stats.totalSize
      ? stats.totalSize - stats.totalUsed
      : null

    const labels = [ $localize`Used (${this.bytesToHuman(stats.totalUsed)})` ]
    const data = [ stats.totalUsed ]

    // Not in manual strategy
    if (totalAvailable) {
      labels.push(
        $localize`Available (${this.bytesToHuman(totalAvailable)})`
      )

      data.push(totalAvailable)
    }

    this.redundanciesGraphsData.push({
      stats,
      ariaLabel: $localize`Redundancy strategy "${stats.strategy}". ` + labels.join('. '),

      graphData: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: [
              '#FF6384',
              '#36A2EB'
            ],
            hoverBackgroundColor: [
              '#FF6384',
              '#36A2EB'
            ]
          }
        ]
      },

      options: {
        plugins: {
          title: {
            display: true,
            text: stats.strategy
          },

          tooltip: {
            callbacks: {
              label: (tooltip: TooltipItem<any>) => {
                return tooltip.label
              }
            }
          }
        }
      }
    })
  }

  async removeRedundancy (redundancy: VideoRedundancy) {
    const message = $localize`Do you really want to remove this video redundancy?`
    const res = await this.confirmService.confirm(message, $localize`Remove redundancy`)
    if (res === false) return

    this.redundancyService.removeVideoRedundancies(redundancy)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Video redundancies removed!`)
          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private _dataLoader (options: DataLoaderOptions) {
    return this.redundancyService.listVideoRedundancies({ ...options, target: this.displayType })
      .pipe(tap(() => this.dataLoaded = true))
  }

  private _customUpdateUrl (): Partial<QueryParams> {
    return {
      displayType: this.displayType
    }
  }

  private _customParseQueryParams (queryParams: QueryParams) {
    if (queryParams.displayType) {
      this.displayType = queryParams.displayType
    }
  }

  private buildColumns () {
    this.columns = [ { id: 'name', label: $localize`Name`, sortable: true } ]

    if (this.isDisplayingRemoteVideos()) {
      this.columns = [
        { id: 'strategy', label: $localize`Strategy`, sortable: false },

        ...this.columns,

        { id: 'totalSize', label: $localize`Total size`, sortable: false }
      ]
    }
  }

  private loadSelectLocalStorage () {
    const displayType = peertubeLocalStorage.getItem(VideoRedundanciesListComponent.LS_DISPLAY_TYPE)
    if (displayType) this.displayType = displayType as VideoRedundanciesTarget
  }

  private saveSelectLocalStorage () {
    peertubeLocalStorage.setItem(VideoRedundanciesListComponent.LS_DISPLAY_TYPE, this.displayType)
  }

  private bytesToHuman (bytes: number) {
    return this.bytesPipe.transform(bytes, 1)
  }
}
