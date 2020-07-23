import { SortMeta } from 'primeng/api'
import { Component, OnInit } from '@angular/core'
import { Notifier, RestPagination, RestTable } from '@app/core'
import { VideoImportService } from '@app/shared/shared-main'
import { VideoImport, VideoImportState } from '@shared/models'

@Component({
  selector: 'my-account-video-imports',
  templateUrl: './my-account-video-imports.component.html',
  styleUrls: [ './my-account-video-imports.component.scss' ]
})
export class MyAccountVideoImportsComponent extends RestTable implements OnInit {
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
    return 'MyAccountVideoImportsComponent'
  }

  getVideoImportStateClass (state: VideoImportState) {
    switch (state) {
      case VideoImportState.FAILED:
        return 'badge-red'
      case VideoImportState.REJECTED:
        return 'badge-banned'
      case VideoImportState.PENDING:
        return 'badge-yellow'
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

  getVideoUrl (video: { uuid: string }) {
    return '/videos/watch/' + video.uuid
  }

  getEditVideoUrl (video: { uuid: string }) {
    return '/videos/update/' + video.uuid
  }

  protected loadData () {
    this.videoImportService.getMyVideoImports(this.pagination, this.sort)
        .subscribe(
          resultList => {
            this.videoImports = resultList.data
            this.totalRecords = resultList.total
          },

          err => this.notifier.error(err.message)
        )
  }
}
