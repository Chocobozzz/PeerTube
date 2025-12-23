import { Component, inject, input, viewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, ConfirmService, Notifier, RestPagination } from '@app/core'
import { UserRight, WatchedWordsList } from '@peertube/peertube-models'
import { SortMeta } from 'primeng/api'
import { first, switchMap } from 'rxjs'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { ActionDropdownComponent, DropdownAction } from '../shared-main/buttons/action-dropdown.component'
import { ButtonComponent } from '../shared-main/buttons/button.component'
import { PTDatePipe } from '../shared-main/common/date.pipe'
import { NumberFormatterPipe } from '../shared-main/common/number-formatter.pipe'
import { TableColumnInfo, TableComponent } from '../shared-tables/table.component'
import { WatchedWordsListSaveModalComponent } from './watched-words-list-save-modal.component'
import { WatchedWordsListService } from './watched-words-list.service'

@Component({
  selector: 'my-watched-words-list-admin-owner',
  templateUrl: './watched-words-list-admin-owner.component.html',
  imports: [
    GlobalIconComponent,
    ActionDropdownComponent,
    ButtonComponent,
    PTDatePipe,
    WatchedWordsListSaveModalComponent,
    NumberFormatterPipe,
    TableComponent
  ]
})
export class WatchedWordsListAdminOwnerComponent {
  protected router = inject(Router)
  protected route = inject(ActivatedRoute)
  private auth = inject(AuthService)
  private notifier = inject(Notifier)
  private confirmService = inject(ConfirmService)
  private watchedWordsListService = inject(WatchedWordsListService)

  readonly mode = input.required<'user' | 'admin'>()

  readonly saveModal = viewChild<WatchedWordsListSaveModalComponent>('saveModal')
  readonly table = viewChild<TableComponent<WatchedWordsList>>('table')

  actions: DropdownAction<WatchedWordsList>[][] = []

  columns: TableColumnInfo<string>[] = [
    {
      id: 'listName',
      label: $localize`List name`,
      selected: true,
      sortable: true
    },
    {
      id: 'words',
      label: $localize`Words`,
      selected: true,
      sortable: false
    },
    {
      id: 'updatedAt',
      label: $localize`Date`,
      selected: true,
      sortable: true
    }
  ]

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)

    const isDisplayed = () => this.mode() === 'user' || this.auth.getUser().hasRight(UserRight.MANAGE_INSTANCE_WATCHED_WORDS)

    this.actions = [
      [
        {
          iconName: 'edit',
          label: $localize`Update`,
          handler: list => this.openCreateOrUpdateList(list),
          isDisplayed
        }
      ],
      [
        {
          iconName: 'delete',
          label: $localize`Delete`,
          handler: list => this.removeList(list),
          isDisplayed
        }
      ]
    ]
  }

  openCreateOrUpdateList (list?: WatchedWordsList) {
    this.saveModal().show(list)
  }

  onListAddedOrUpdated () {
    this.table().reloadData({ field: 'updatedAt', order: -1 })
  }

  getAccountNameParam () {
    if (this.mode() === 'admin') return undefined

    return this.auth.getUser().account.name
  }

  private _dataLoader (options: {
    pagination: RestPagination
    sort: SortMeta
  }) {
    const { pagination, sort } = options

    return this.auth.userInformationLoaded
      .pipe(
        first(),
        switchMap(() => this.watchedWordsListService.list({ pagination, sort, accountName: this.getAccountNameParam() }))
      )
  }

  private async removeList (list: WatchedWordsList) {
    const message = $localize`Are you sure you want to delete this ${list.listName} list?`
    const res = await this.confirmService.confirm(message, $localize`Delete list`)
    if (res === false) return

    this.watchedWordsListService.deleteList({
      listId: list.id,
      accountName: this.getAccountNameParam()
    }).subscribe({
      next: () => {
        this.notifier.success($localize`${list.listName} removed`)

        this.table().loadData()
      },

      error: err => this.notifier.handleError(err)
    })
  }
}
