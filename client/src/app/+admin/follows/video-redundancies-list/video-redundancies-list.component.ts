import { BytesPipe } from 'ngx-pipes'
import { SortMeta } from 'primeng/api'
import { Component, OnInit } from '@angular/core'
import { ConfirmService, Notifier, RestPagination, RestTable, ServerService } from '@app/core'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { RedundancyService } from '@app/shared/shared-main'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoRedundanciesTarget, VideoRedundancy } from '@shared/models'
import { VideosRedundancyStats } from '@shared/models/server'

@Component({
  selector: 'my-video-redundancies-list',
  templateUrl: './video-redundancies-list.component.html',
  styleUrls: [ '../follows.component.scss', './video-redundancies-list.component.scss' ]
})
export class VideoRedundanciesListComponent extends RestTable implements OnInit {
  private static LOCAL_STORAGE_DISPLAY_TYPE = 'video-redundancies-list-display-type'

  videoRedundancies: VideoRedundancy[] = []
  totalRecords = 0

  sort: SortMeta = { field: 'name', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }
  displayType: VideoRedundanciesTarget = 'my-videos'

  redundanciesGraphsData: { stats: VideosRedundancyStats, graphData: object, options: object }[] = []

  noRedundancies = false

  private bytesPipe: BytesPipe

  constructor (
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private redundancyService: RedundancyService,
    private serverService: ServerService,
    private i18n: I18n
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

  getColspan () {
    if (this.isDisplayingRemoteVideos()) return 5

    return 4
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

    this.loadData()
  }

  getRedundancyStrategy (redundancy: VideoRedundancy) {
    if (redundancy.redundancies.files.length !== 0) return redundancy.redundancies.files[0].strategy
    if (redundancy.redundancies.streamingPlaylists.length !== 0) return redundancy.redundancies.streamingPlaylists[0].strategy

    return ''
  }

  buildPieData (stats: VideosRedundancyStats) {
    const totalSize = stats.totalSize
      ? stats.totalSize - stats.totalUsed
      : stats.totalUsed

    if (totalSize === 0) return

    this.redundanciesGraphsData.push({
      stats,
      graphData: {
        labels: [ this.i18n('Used'), this.i18n('Available') ],
        datasets: [
          {
            data: [ stats.totalUsed, totalSize ],
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
        title: {
          display: true,
          text: stats.strategy
        },

        tooltips: {
          callbacks: {
            label: (tooltipItem: any, data: any) => {
              const dataset = data.datasets[tooltipItem.datasetIndex]
              let label = data.labels[tooltipItem.index]
              if (label) label += ': '
              else label = ''

              label += this.bytesPipe.transform(dataset.data[tooltipItem.index], 1)
              return label
            }
          }
        }
      }
    })
  }

  async removeRedundancy (redundancy: VideoRedundancy) {
    const message = this.i18n('Do you really want to remove this video redundancy?')
    const res = await this.confirmService.confirm(message, this.i18n('Remove redundancy'))
    if (res === false) return

    this.redundancyService.removeVideoRedundancies(redundancy)
      .subscribe(
        () => {
          this.notifier.success(this.i18n('Video redundancies removed!'))
          this.loadData()
        },

        err => this.notifier.error(err.message)
      )

  }

  protected loadData () {
    const options = {
      pagination: this.pagination,
      sort: this.sort,
      target: this.displayType
    }

    this.redundancyService.listVideoRedundancies(options)
                      .subscribe(
                        resultList => {
                          this.videoRedundancies = resultList.data
                          this.totalRecords = resultList.total
                        },

                        err => this.notifier.error(err.message)
                      )
  }

  private loadSelectLocalStorage () {
    const displayType = peertubeLocalStorage.getItem(VideoRedundanciesListComponent.LOCAL_STORAGE_DISPLAY_TYPE)
    if (displayType) this.displayType = displayType as VideoRedundanciesTarget
  }

  private saveSelectLocalStorage () {
    peertubeLocalStorage.setItem(VideoRedundanciesListComponent.LOCAL_STORAGE_DISPLAY_TYPE, this.displayType)
  }
}
