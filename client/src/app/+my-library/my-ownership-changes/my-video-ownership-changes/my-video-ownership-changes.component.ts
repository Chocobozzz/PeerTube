import { CommonModule, NgClass } from '@angular/common'
import { Component, inject, viewChild } from '@angular/core'
import { AuthService, Notifier } from '@app/core'
import { Account } from '@app/shared/shared-main/account/account.model'
import { buildDropdownSimpleAndBulkActions } from '@app/shared/shared-main/buttons/action-dropdown-helpers'
import { ActionDropdownComponent, DropdownAction } from '@app/shared/shared-main/buttons/action-dropdown.component'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { ChangeOwnershipService } from '@app/shared/shared-change-ownership/change-ownership.service'
import { ActorCellComponent } from '@app/shared/shared-tables/actor-cell.component'
import { DataLoaderOptionsBase, TableColumnInfo, TableComponent } from '@app/shared/shared-tables/table.component'
import { ChangeOwnership, ChangeOwnershipState, ChangeOwnershipStateType } from '@peertube/peertube-models'
import { map } from 'rxjs'
import { NumberFormatterPipe } from '../../../shared/shared-main/common/number-formatter.pipe'
import { VideoCellComponent } from '../../../shared/shared-tables/video-cell.component'
import { AcceptChangeVideoOwnershipComponent } from './accept-change-video-ownership.component'

@Component({
  selector: 'my-video-ownership-changes',
  templateUrl: './my-video-ownership-changes.component.html',
  imports: [
    CommonModule,
    NgClass,
    AcceptChangeVideoOwnershipComponent,
    PTDatePipe,
    VideoCellComponent,
    NumberFormatterPipe,
    TableComponent,
    ActionDropdownComponent,
    ActorCellComponent
  ]
})
export class MyVideoOwnershipChangesComponent {
  private notifier = inject(Notifier)
  private changeOwnershipService = inject(ChangeOwnershipService)
  private authService = inject(AuthService)

  readonly acceptChangeVideoOwnershipComponent = viewChild<AcceptChangeVideoOwnershipComponent>('acceptChangeVideoOwnershipComponent')
  readonly table = viewChild<TableComponent<ChangeOwnership>>('table')

  actions: DropdownAction<ChangeOwnership>[][] = []
  bulkActions: DropdownAction<ChangeOwnership[]>[][] = []

  columns: TableColumnInfo<string>[] = [
    { id: 'video', label: $localize`Video`, sortable: false },
    { id: 'targetAccount', label: $localize`Target account`, sortable: false },
    { id: 'createdAt', label: $localize`Created`, sortable: true },
    { id: 'status', label: $localize`Status`, sortable: false }
  ]

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)

    const { simpleActions, bulkActions } = buildDropdownSimpleAndBulkActions<ChangeOwnership>([
      [
        {
          label: () => $localize`Accept`,
          handler: changeOwnership => this.openAcceptModal(changeOwnership),
          isDisplayed: changeOwnership => this.canAcceptOrReject(changeOwnership),
          enableBulk: true
        },
        {
          label: () => $localize`Reject`,
          handler: changeOwnership => this.reject(changeOwnership),
          isDisplayed: changeOwnership => this.canAcceptOrReject(changeOwnership),
          enableBulk: true
        }
      ]
    ])

    this.actions = simpleActions
    this.bulkActions = bulkActions
  }

  private canAcceptOrReject (changeOwnership: ChangeOwnership) {
    return this.isReceiver(changeOwnership) && changeOwnership.state.id === ChangeOwnershipState.PENDING
  }

  isReceiver (changeOwnership: ChangeOwnership) {
    return changeOwnership.nextOwnerAccount.id === this.authService.getUser().account.id
  }

  getStateClass (status: ChangeOwnershipStateType) {
    switch (status) {
      case ChangeOwnershipState.ACCEPTED:
        return 'badge-green'

      case ChangeOwnershipState.REJECTED:
        return 'badge-red'

      default:
        return 'badge-yellow'
    }
  }

  openAcceptModal (entries: ChangeOwnership[]) {
    this.acceptChangeVideoOwnershipComponent().show(entries)
  }

  accepted () {
    this.table().loadData()
  }

  reject (entries: ChangeOwnership[]) {
    this.changeOwnershipService.rejectVideo(entries.map(entry => entry.id))
      .subscribe({
        next: () => this.table().loadData(),
        error: err => this.notifier.handleError(err)
      })
  }

  private _dataLoader (options: DataLoaderOptionsBase) {
    return this.changeOwnershipService.listOfVideos(options.pagination, options.sort)
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
