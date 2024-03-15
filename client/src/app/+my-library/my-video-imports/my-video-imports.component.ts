import { SortMeta, SharedModule } from 'primeng/api'
import { Component, OnInit } from '@angular/core'
import { Notifier, RestPagination, RestTable } from '@app/core'
import { VideoImport, VideoImportState, VideoImportStateType } from '@peertube/peertube-models'
import { AutoColspanDirective } from '../../shared/shared-main/angular/auto-colspan.directive'
import { EditButtonComponent } from '../../shared/shared-main/buttons/edit-button.component'
import { DeleteButtonComponent } from '../../shared/shared-main/buttons/delete-button.component'
import { ButtonComponent } from '../../shared/shared-main/buttons/button.component'
import { TableExpanderIconComponent } from '../../shared/shared-tables/table-expander-icon.component'
import { NgIf, NgClass, DatePipe } from '@angular/common'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { TableModule } from 'primeng/table'
import { AdvancedInputFilterComponent } from '../../shared/shared-forms/advanced-input-filter.component'
import { RouterLink } from '@angular/router'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { VideoImportService } from '@app/shared/shared-main/video/video-import.service'
import { Video } from '@app/shared/shared-main/video/video.model'

@Component({
  templateUrl: './my-video-imports.component.html',
  styleUrls: [ './my-video-imports.component.scss' ],
  standalone: true,
  imports: [
    GlobalIconComponent,
    RouterLink,
    AdvancedInputFilterComponent,
    TableModule,
    SharedModule,
    NgbTooltip,
    NgIf,
    TableExpanderIconComponent,
    ButtonComponent,
    DeleteButtonComponent,
    EditButtonComponent,
    NgClass,
    AutoColspanDirective,
    DatePipe
  ]
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
