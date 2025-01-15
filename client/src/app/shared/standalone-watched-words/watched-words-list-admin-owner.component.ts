import { NgClass, NgIf } from '@angular/common'
import { Component, Input, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, ConfirmService, Notifier, RestPagination, RestTable } from '@app/core'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { UserRight, WatchedWordsList } from '@peertube/peertube-models'
import { SharedModule, SortMeta } from 'primeng/api'
import { TableModule } from 'primeng/table'
import { first } from 'rxjs'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { ActionDropdownComponent, DropdownAction } from '../shared-main/buttons/action-dropdown.component'
import { ButtonComponent } from '../shared-main/buttons/button.component'
import { AutoColspanDirective } from '../shared-main/common/auto-colspan.directive'
import { PTDatePipe } from '../shared-main/common/date.pipe'
import { TableExpanderIconComponent } from '../shared-tables/table-expander-icon.component'
import { WatchedWordsListSaveModalComponent } from './watched-words-list-save-modal.component'
import { WatchedWordsListService } from './watched-words-list.service'

@Component({
  selector: 'my-watched-words-list-admin-owner',
  templateUrl: './watched-words-list-admin-owner.component.html',
  standalone: true,
  imports: [
    GlobalIconComponent,
    TableModule,
    SharedModule,
    NgIf,
    ActionDropdownComponent,
    ButtonComponent,
    TableExpanderIconComponent,
    NgClass,
    AutoColspanDirective,
    PTDatePipe,
    NgbTooltip,
    WatchedWordsListSaveModalComponent
  ]
})
export class WatchedWordsListAdminOwnerComponent extends RestTable<WatchedWordsList> implements OnInit {
  @Input({ required: true }) mode: 'user' | 'admin'

  @ViewChild('saveModal', { static: true }) saveModal: WatchedWordsListSaveModalComponent

  lists: WatchedWordsList[]
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  actions: DropdownAction<WatchedWordsList>[][] = []

  get authUser () {
    return this.auth.getUser()
  }

  get accountNameParam () {
    if (this.mode === 'admin') return undefined

    return this.authUser.account.name
  }

  constructor (
    protected router: Router,
    protected route: ActivatedRoute,
    private auth: AuthService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private watchedWordsListService: WatchedWordsListService
  ) {
    super()

    const isDisplayed = () => this.mode === 'user' || this.authUser.hasRight(UserRight.MANAGE_INSTANCE_WATCHED_WORDS)

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

  ngOnInit () {
    this.initialize()

    this.auth.userInformationLoaded
      .pipe(first())
      .subscribe(() => this.reloadData())
  }

  getIdentifier () {
    return 'WatchedWordsListAdminOwnerComponent'
  }

  openCreateOrUpdateList (list?: WatchedWordsList) {
    this.saveModal.show(list)
  }

  protected reloadDataInternal () {
    this.watchedWordsListService.list({ pagination: this.pagination, sort: this.sort, accountName: this.accountNameParam })
      .subscribe({
        next: resultList => {
          this.totalRecords = resultList.total
          this.lists = resultList.data
        },

        error: err => this.notifier.error(err.message)
      })
  }

  private async removeList (list: WatchedWordsList) {
    const message = $localize`Are you sure you want to delete this ${list.listName} list?`
    const res = await this.confirmService.confirm(message, $localize`Delete list`)
    if (res === false) return

    this.watchedWordsListService.deleteList({
      listId: list.id,
      accountName: this.accountNameParam
    }).subscribe({
      next: () => {
        this.notifier.success($localize`${list.listName} removed`)

        this.reloadData()
      },

      error: err => this.notifier.error(err.message)
    })
  }

}
