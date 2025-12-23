import { CommonModule, NgClass } from '@angular/common'
import { Component, inject, viewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { Account } from '@app/shared/shared-main/account/account.model'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { VideoOwnershipService } from '@app/shared/shared-main/video/video-ownership.service'
import { DataLoaderOptions, TableColumnInfo, TableComponent } from '@app/shared/shared-tables/table.component'
import { VideoChangeOwnership, VideoChangeOwnershipStatus, VideoChangeOwnershipStatusType } from '@peertube/peertube-models'
import { map } from 'rxjs'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { ButtonComponent } from '../../shared/shared-main/buttons/button.component'
import { NumberFormatterPipe } from '../../shared/shared-main/common/number-formatter.pipe'
import { VideoCellComponent } from '../../shared/shared-tables/video-cell.component'
import { MyAcceptOwnershipComponent } from './my-accept-ownership/my-accept-ownership.component'

@Component({
  templateUrl: './my-ownership.component.html',
  imports: [
    CommonModule,
    ButtonComponent,
    ActorAvatarComponent,
    NgClass,
    MyAcceptOwnershipComponent,
    PTDatePipe,
    VideoCellComponent,
    NumberFormatterPipe,
    TableComponent
  ]
})
export class MyOwnershipComponent {
  private notifier = inject(Notifier)
  private videoOwnershipService = inject(VideoOwnershipService)

  readonly myAccountAcceptOwnershipComponent = viewChild<MyAcceptOwnershipComponent>('myAcceptOwnershipComponent')
  readonly table = viewChild<TableComponent<VideoChangeOwnership>>('table')

  columns: TableColumnInfo<string>[] = [
    { id: 'initiator', label: $localize`Initiator`, sortable: false },
    { id: 'video', label: $localize`Video`, sortable: false },
    { id: 'createdAt', label: $localize`Created`, sortable: true },
    { id: 'status', label: $localize`Status`, sortable: false }
  ]

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)
  }

  getStatusClass (status: VideoChangeOwnershipStatusType) {
    switch (status) {
      case VideoChangeOwnershipStatus.ACCEPTED:
        return 'badge-green'
      case VideoChangeOwnershipStatus.REFUSED:
        return 'badge-red'
      default:
        return 'badge-yellow'
    }
  }

  openAcceptModal (videoChangeOwnership: VideoChangeOwnership) {
    this.myAccountAcceptOwnershipComponent().show(videoChangeOwnership)
  }

  accepted () {
    this.table().loadData()
  }

  refuse (videoChangeOwnership: VideoChangeOwnership) {
    this.videoOwnershipService.refuseOwnership(videoChangeOwnership.id)
      .subscribe({
        next: () => this.table().loadData(),
        error: err => this.notifier.handleError(err)
      })
  }

  private _dataLoader (options: DataLoaderOptions) {
    return this.videoOwnershipService.getOwnershipChanges(options.pagination, options.sort)
      .pipe(
        map(resultList => ({
          data: resultList.data.map(change => ({
            ...change,

            initiatorAccount: new Account(change.initiatorAccount),
            nextOwnerAccount: new Account(change.nextOwnerAccount)
          })),
          total: resultList.total
        }))
      )
  }
}
