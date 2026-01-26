import { CommonModule } from '@angular/common'
import { Component, inject, OnInit, viewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { ActionDropdownComponent, DropdownAction } from '@app/shared/shared-main/buttons/action-dropdown.component'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { VideoImportService } from '@app/shared/shared-main/video/video-import.service'
import { Video } from '@app/shared/shared-main/video/video.model'
import { ActorCellComponent } from '@app/shared/shared-tables/actor-cell.component'
import { VideoImport, VideoImportState, VideoImportStateType } from '@peertube/peertube-models'
import { AdvancedInputFilterComponent } from '../../shared/shared-forms/advanced-input-filter.component'
import { NumberFormatterPipe } from '../../shared/shared-main/common/number-formatter.pipe'
import { DataLoaderOptions, TableColumnInfo, TableComponent } from '../../shared/shared-tables/table.component'

@Component({
  templateUrl: './my-video-imports.component.html',
  styleUrls: [ './my-video-imports.component.scss' ],
  imports: [
    AdvancedInputFilterComponent,
    CommonModule,
    CommonModule,
    PTDatePipe,
    TableComponent,
    NumberFormatterPipe,
    ActorCellComponent,
    ActionDropdownComponent
  ]
})
export class MyVideoImportsComponent implements OnInit {
  private notifier = inject(Notifier)
  private videoImportService = inject(VideoImportService)

  readonly table = viewChild<TableComponent<VideoImport>>('table')

  videoImportActions: DropdownAction<VideoImport>[] = []

  columns: TableColumnInfo<string>[] = [
    { id: 'target', label: $localize`Target`, sortable: false },
    { id: 'channel', label: $localize`Channel`, sortable: false },
    { id: 'video', label: $localize`Video`, sortable: false },
    { id: 'state', label: $localize`State`, sortable: false },
    { id: 'createdAt', label: $localize`Created`, sortable: true }
  ]

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)
  }

  ngOnInit () {
    this.videoImportActions = [
      {
        label: $localize`Cancel import`,
        iconName: 'no',
        handler: videoImport => this.cancelImport(videoImport),
        isDisplayed: videoImport => this.isVideoImportPending(videoImport)
      },
      {
        label: $localize`Retry import`,
        iconName: 'refresh',
        handler: videoImport => this.retryImport(videoImport),
        isDisplayed: videoImport => this.isVideoImportFailed(videoImport)
      },
      {
        label: $localize`Delete import task`,
        description: $localize`The associated video is not deleted`,
        iconName: 'delete',
        handler: videoImport => this.deleteImport(videoImport),
        isDisplayed: videoImport => {
          return this.isVideoImportFailed(videoImport) || this.isVideoImportCancelled(videoImport) || !videoImport.video
        }
      },
      {
        label: $localize`Edit video`,
        iconName: 'edit',
        linkBuilder: videoImport => [ this.getEditVideoUrl(videoImport.video) ],
        isDisplayed: videoImport => this.isVideoImportSuccess(videoImport) && !!videoImport.video
      }
    ]
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

        error: err => this.notifier.handleError(err)
      })
  }

  cancelImport (videoImport: VideoImport) {
    this.videoImportService.cancelVideoImport(videoImport)
      .subscribe({
        next: () => this.table().loadData(),

        error: err => this.notifier.handleError(err)
      })
  }

  retryImport (videoImport: VideoImport) {
    this.videoImportService.retryVideoImport(videoImport)
      .subscribe({
        next: () => this.table().loadData(),

        error: err => this.notifier.handleError(err)
      })
  }

  private _dataLoader (options: DataLoaderOptions) {
    return this.videoImportService.listMyVideoImports({ ...options, includeCollaborations: true })
  }
}
