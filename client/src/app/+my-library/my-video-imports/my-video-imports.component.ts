import { CommonModule, NgClass } from '@angular/common'
import { Component, inject, viewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { VideoImportService } from '@app/shared/shared-main/video/video-import.service'
import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoImport, VideoImportState, VideoImportStateType } from '@peertube/peertube-models'
import { AdvancedInputFilterComponent } from '../../shared/shared-forms/advanced-input-filter.component'
import { ButtonComponent } from '../../shared/shared-main/buttons/button.component'
import { DeleteButtonComponent } from '../../shared/shared-main/buttons/delete-button.component'
import { EditButtonComponent } from '../../shared/shared-main/buttons/edit-button.component'
import { NumberFormatterPipe } from '../../shared/shared-main/common/number-formatter.pipe'
import { DataLoaderOptions, TableColumnInfo, TableComponent } from '../../shared/shared-tables/table.component'

@Component({
  templateUrl: './my-video-imports.component.html',
  styleUrls: [ './my-video-imports.component.scss' ],
  imports: [
    AdvancedInputFilterComponent,
    CommonModule,
    ButtonComponent,
    DeleteButtonComponent,
    EditButtonComponent,
    NgClass,
    PTDatePipe,
    TableComponent,
    NumberFormatterPipe
  ]
})
export class MyVideoImportsComponent {
  private notifier = inject(Notifier)
  private videoImportService = inject(VideoImportService)

  readonly table = viewChild<TableComponent<VideoImport>>('table')

  columns: TableColumnInfo<string>[] = [
    { id: 'target', label: $localize`Target`, sortable: false },
    { id: 'video', label: $localize`Video`, sortable: false },
    { id: 'state', label: $localize`State`, sortable: false },
    { id: 'createdAt', label: $localize`Created`, sortable: true }
  ]

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)
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
        next: () => this.table().loadData(),

        error: err => this.notifier.error(err.message)
      })
  }

  cancelImport (videoImport: VideoImport) {
    this.videoImportService.cancelVideoImport(videoImport)
      .subscribe({
        next: () => this.table().loadData(),

        error: err => this.notifier.error(err.message)
      })
  }

  private _dataLoader (options: DataLoaderOptions) {
    return this.videoImportService.getMyVideoImports(options)
  }
}
