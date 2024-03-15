import { ChartData, ChartOptions, TooltipItem } from 'chart.js'
import { SortMeta, SharedModule } from 'primeng/api'
import { Component, OnInit } from '@angular/core'
import { ConfirmService, Notifier, RestPagination, RestTable, ServerService } from '@app/core'
import { VideoRedundanciesTarget, VideoRedundancy, VideosRedundancyStats } from '@peertube/peertube-models'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { ChartModule } from 'primeng/chart'
import { VideoRedundancyInformationComponent } from './video-redundancy-information.component'
import { AutoColspanDirective } from '../../../shared/shared-main/angular/auto-colspan.directive'
import { DeleteButtonComponent } from '../../../shared/shared-main/buttons/delete-button.component'
import { TableExpanderIconComponent } from '../../../shared/shared-tables/table-expander-icon.component'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { NgIf, NgFor } from '@angular/common'
import { TableModule } from 'primeng/table'
import { FormsModule } from '@angular/forms'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { BytesPipe } from '@app/shared/shared-main/angular/bytes.pipe'
import { RedundancyService } from '@app/shared/shared-main/video/redundancy.service'

@Component({
  selector: 'my-video-redundancies-list',
  templateUrl: './video-redundancies-list.component.html',
  styleUrls: [ './video-redundancies-list.component.scss' ],
  standalone: true,
  imports: [
    GlobalIconComponent,
    FormsModule,
    TableModule,
    SharedModule,
    NgIf,
    NgbTooltip,
    TableExpanderIconComponent,
    DeleteButtonComponent,
    AutoColspanDirective,
    NgFor,
    VideoRedundancyInformationComponent,
    ChartModule,
    BytesPipe
  ]
})
export class VideoRedundanciesListComponent extends RestTable implements OnInit {
  private static LOCAL_STORAGE_DISPLAY_TYPE = 'video-redundancies-list-display-type'

  videoRedundancies: VideoRedundancy[] = []
  totalRecords = 0

  sort: SortMeta = { field: 'name', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }
  displayType: VideoRedundanciesTarget = 'my-videos'

  redundanciesGraphsData: { stats: VideosRedundancyStats, graphData: ChartData, options: ChartOptions }[] = []

  noRedundancies = false

  // Prevent layout shift for redundancy stats
  dataLoaded = false

  private bytesPipe: BytesPipe

  constructor (
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private redundancyService: RedundancyService,
    private serverService: ServerService
  ) {
    super()

    this.bytesPipe = new BytesPipe()
  }

  getIdentifier () {
    return 'VideoRedundanciesListComponent'
  }

  ngOnInit () {
    this.loadSelectLocalStorage()

    this.initialize()

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
    return redundancy.redundancies.files.reduce((a, b) => a + b.size, 0) +
      redundancy.redundancies.streamingPlaylists.reduce((a, b) => a + b.size, 0)
  }

  onDisplayTypeChanged () {
    this.pagination.start = 0
    this.saveSelectLocalStorage()

    this.reloadData()
  }

  getRedundancyStrategy (redundancy: VideoRedundancy) {
    if (redundancy.redundancies.files.length !== 0) return redundancy.redundancies.files[0].strategy
    if (redundancy.redundancies.streamingPlaylists.length !== 0) return redundancy.redundancies.streamingPlaylists[0].strategy

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
          this.reloadData()
        },

        error: err => this.notifier.error(err.message)
      })

  }

  protected reloadDataInternal () {
    this.dataLoaded = false

    const options = {
      pagination: this.pagination,
      sort: this.sort,
      target: this.displayType
    }

    this.redundancyService.listVideoRedundancies(options)
                      .subscribe({
                        next: resultList => {
                          this.videoRedundancies = resultList.data
                          this.totalRecords = resultList.total

                          this.dataLoaded = true
                        },

                        error: err => this.notifier.error(err.message)
                      })
  }

  private loadSelectLocalStorage () {
    const displayType = peertubeLocalStorage.getItem(VideoRedundanciesListComponent.LOCAL_STORAGE_DISPLAY_TYPE)
    if (displayType) this.displayType = displayType as VideoRedundanciesTarget
  }

  private saveSelectLocalStorage () {
    peertubeLocalStorage.setItem(VideoRedundanciesListComponent.LOCAL_STORAGE_DISPLAY_TYPE, this.displayType)
  }

  private bytesToHuman (bytes: number) {
    return this.bytesPipe.transform(bytes, 1)
  }
}
