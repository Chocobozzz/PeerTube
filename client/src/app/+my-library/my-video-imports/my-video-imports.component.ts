import { SortMeta } from 'primeng/api'
import { Component, OnInit } from '@angular/core'
import { Notifier, RestPagination, RestTable } from '@app/core'
import { Video, VideoImportService } from '@app/shared/shared-main'
import { VideoImport, VideoImportState, VideoImportStateType } from '@peertube/peertube-models'

@Component({
  templateUrl: './my-video-imports.component.html',
  styleUrls: [ './my-video-imports.component.scss' ]
})
export class MyVideoImportsComponent extends RestTable implements OnInit {
  videoImports: VideoImport[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private notifier: Notifier,
    private videoImportService: VideoImportService
  ) {
    super()
  }

  ngOnInit () {
    this.initialize()
  }

  getIdentifier () {
    return 'MyVideoImportsComponent'
  }

  getVideoImportStateClass (state: VideoImportStateType) {
    switch (state) {
      case VideoImportState.FAILED:
        return 'badge-red'

      case VideoImportState.REJECTED:
        return 'badge-banned'

      case VideoImportState.PENDING:
        return 'badge-yellow'

      case VideoImportState.PROCESSING:
        return 'badge-blue'

      default:
        return 'badge-green'
    }
  }

  isVideoImportSuccess (videoImport: VideoImport) {
    return videoImport.state.id === VideoImportState.SUCCESS
  }

  isVideoImportPending (videoImport: VideoImport) {
    return videoImport.state.id === VideoImportState.PENDING
  }

  isVideoImportFailed (videoImport: VideoImport) {
    return videoImport.state.id === VideoImportState.FAILED
  }

  isVideoImportCancelled (videoImport: VideoImport) {
    return videoImport.state.id === VideoImportState.CANCELLED
  }

  getVideoUrl (video: { uuid: string }) {
    return Video.buildWatchUrl(video)
  }

  getEditVideoUrl (video: { uuid: string }) {
    return Video.buildUpdateUrl(video)
  }

  deleteImport (videoImport: VideoImport) {
    this.videoImportService.deleteVideoImport(videoImport)
      .subscribe({
        next: () => this.reloadData(),

        error: err => this.notifier.error(err.message)
      })
  }

  cancelImport (videoImport: VideoImport) {
    this.videoImportService.cancelVideoImport(videoImport)
      .subscribe({
        next: () => this.reloadData(),

        error: err => this.notifier.error(err.message)
      })
  }

  protected reloadDataInternal () {
    this.videoImportService.getMyVideoImports(this.pagination, this.sort, this.search)
        .subscribe({
          next: resultList => {
            this.videoImports = resultList.data
            this.totalRecords = resultList.total
          },

          error: err => this.notifier.error(err.message)
        })
  }
}
