import { Component, OnInit, inject, viewChild } from '@angular/core'
import { ConfirmService, Notifier } from '@app/core'
import { formatICU } from '@app/helpers'
import { InstanceFollowService } from '@app/shared/shared-instance/instance-follow.service'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { ActorFollow } from '@peertube/peertube-models'
import { AdvancedInputFilter, AdvancedInputFilterComponent } from '../../../shared/shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { DropdownAction } from '../../../shared/shared-main/buttons/action-dropdown.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { DeleteButtonComponent } from '../../../shared/shared-main/buttons/delete-button.component'
import { NumberFormatterPipe } from '../../../shared/shared-main/common/number-formatter.pipe'
import { DataLoaderOptions, TableColumnInfo, TableComponent } from '../../../shared/shared-tables/table.component'
import { RedundancyCheckboxComponent } from '../shared/redundancy-checkbox.component'
import { FollowModalComponent } from './follow-modal.component'

@Component({
  templateUrl: './following-list.component.html',
  styleUrls: [ './following-list.component.scss' ],
  imports: [
    GlobalIconComponent,
    AdvancedInputFilterComponent,
    DeleteButtonComponent,
    RedundancyCheckboxComponent,
    FollowModalComponent,
    PTDatePipe,
    ButtonComponent,
    TableComponent,
    NumberFormatterPipe
  ]
})
export class FollowingListComponent implements OnInit {
  private notifier = inject(Notifier)
  private confirmService = inject(ConfirmService)
  private followService = inject(InstanceFollowService)

  readonly followModal = viewChild<FollowModalComponent>('followModal')
  readonly table = viewChild<TableComponent<ActorFollow>>('table')

  searchFilters: AdvancedInputFilter[] = []

  bulkActions: DropdownAction<ActorFollow[]>[] = []

  columns: TableColumnInfo<string>[] = [
    { id: 'following', label: $localize`Following`, sortable: false },
    { id: 'state', label: $localize`State`, sortable: true },
    { id: 'createdAt', label: $localize`Created`, sortable: true },
    { id: 'redundancyAllowed', label: $localize`Redundancy allowed`, sortable: true }
  ]

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)
  }

  ngOnInit () {
    this.searchFilters = this.followService.buildFollowsListFilters()

    this.bulkActions = [
      {
        label: $localize`Delete`,
        handler: follows => this.removeFollowing(follows)
      }
    ]
  }

  openFollowModal () {
    this.followModal().openModal()
  }

  isInstanceFollowing (follow: ActorFollow) {
    return follow.following.name === 'peertube'
  }

  buildFollowingName (follow: ActorFollow) {
    return follow.following.name + '@' + follow.following.host
  }

  async removeFollowing (follows: ActorFollow[]) {
    const icuParams = { count: follows.length, entryName: this.buildFollowingName(follows[0]) }

    const message = formatICU(
      $localize`Do you really want to unfollow {count, plural, =1 {{entryName}?} other {{count} entries?}}`,
      icuParams
    )

    const res = await this.confirmService.confirm(message, $localize`Unfollow`)
    if (res === false) return

    this.followService.unfollow(follows)
      .subscribe({
        next: () => {
          const message = formatICU(
            $localize`You are not following {count, plural, =1 {{entryName} anymore.} other {these {count} entries anymore.}}`,
            icuParams
          )

          this.notifier.success(message)
          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private _dataLoader (options: DataLoaderOptions) {
    const { pagination, sort, search } = options

    return this.followService.getFollowing({ pagination, sort, search })
  }
}
