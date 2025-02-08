import { NgClass, NgIf } from '@angular/common'
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import {
  AuthService,
  ConfirmService,
  HooksService,
  LocalStorageService,
  Notifier,
  PluginService,
  RestPagination,
  RestTable
} from '@app/core'
import { formatICU, getAPIHost } from '@app/helpers'
import { Actor } from '@app/shared/shared-main/account/actor.model'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { ProgressBarComponent } from '@app/shared/shared-main/common/progress-bar.component'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { UserBanModalComponent } from '@app/shared/shared-moderation/user-ban-modal.component'
import { UserAdminService } from '@app/shared/shared-users/user-admin.service'
import { NgbDropdown, NgbDropdownMenu, NgbDropdownToggle, NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { User, UserRole, UserRoleType } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { SharedModule, SortMeta } from 'primeng/api'
import { TableModule } from 'primeng/table'
import { lastValueFrom } from 'rxjs'
import { ActorAvatarComponent } from '../../../../shared/shared-actor-image/actor-avatar.component'
import { AdvancedInputFilter, AdvancedInputFilterComponent } from '../../../../shared/shared-forms/advanced-input-filter.component'
import { PeertubeCheckboxComponent } from '../../../../shared/shared-forms/peertube-checkbox.component'
import { SelectCheckboxComponent } from '../../../../shared/shared-forms/select/select-checkbox.component'
import { GlobalIconComponent } from '../../../../shared/shared-icons/global-icon.component'
import { ActionDropdownComponent, DropdownAction } from '../../../../shared/shared-main/buttons/action-dropdown.component'
import { AutoColspanDirective } from '../../../../shared/shared-main/common/auto-colspan.directive'
import { BytesPipe } from '../../../../shared/shared-main/common/bytes.pipe'
import {
  AccountMutedStatus,
  UserModerationDisplayType,
  UserModerationDropdownComponent
} from '../../../../shared/shared-moderation/user-moderation-dropdown.component'
import { TableExpanderIconComponent } from '../../../../shared/shared-tables/table-expander-icon.component'
import { UserEmailInfoComponent } from '../../../shared/user-email-info.component'

type UserForList = User & {
  rawVideoQuota: number
  rawVideoQuotaUsed: number
  rawVideoQuotaDaily: number
  rawVideoQuotaUsedDaily: number
}

@Component({
  selector: 'my-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: [ './user-list.component.scss' ],
  imports: [
    GlobalIconComponent,
    TableModule,
    SharedModule,
    NgIf,
    ActionDropdownComponent,
    RouterLink,
    AdvancedInputFilterComponent,
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu,
    SelectCheckboxComponent,
    FormsModule,
    PeertubeCheckboxComponent,
    NgbTooltip,
    NgClass,
    TableExpanderIconComponent,
    UserModerationDropdownComponent,
    ActorAvatarComponent,
    UserEmailInfoComponent,
    AutoColspanDirective,
    UserBanModalComponent,
    PTDatePipe,
    BytesPipe,
    ProgressBarComponent
  ]
})
export class UserListComponent extends RestTable <User> implements OnInit, OnDestroy {
  private static readonly LS_SELECTED_COLUMNS_KEY = 'admin-user-list-selected-columns'

  @ViewChild('userBanModal', { static: true }) userBanModal: UserBanModalComponent

  users: (User & { accountMutedStatus: AccountMutedStatus })[] = []

  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  highlightBannedUsers = false

  bulkActions: DropdownAction<User[]>[][] = []
  columns: { id: string, label: string }[]

  inputFilters: AdvancedInputFilter[] = [
    {
      title: $localize`Advanced filters`,
      children: [
        {
          value: 'banned:true',
          label: $localize`Banned users`
        }
      ]
    }
  ]

  userModerationDisplayOptions: UserModerationDisplayType = {
    instanceAccount: true,
    instanceUser: true,
    myAccount: false
  }

  private _selectedColumns: string[] = []

  constructor (
    protected route: ActivatedRoute,
    protected router: Router,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private auth: AuthService,
    private blocklist: BlocklistService,
    private userAdminService: UserAdminService,
    private peertubeLocalStorage: LocalStorageService,
    private hooks: HooksService,
    private pluginService: PluginService
  ) {
    super()
  }

  get authUser () {
    return this.auth.getUser()
  }

  get selectedColumns () {
    return this._selectedColumns || []
  }

  set selectedColumns (val: string[]) {
    this._selectedColumns = val

    this.saveSelectedColumns()
  }

  async ngOnInit () {
    this.initialize()

    this.pluginService.addAction('admin-users-list:load-data', () => this.reloadDataInternal())

    const bulkActions: DropdownAction<User[]>[][] = [
      [
        {
          label: $localize`Delete`,
          description: $localize`Videos will be deleted, comments will be tombstoned.`,
          handler: users => this.removeUsers(users),
          isDisplayed: users => users.every(u => this.authUser.canManage(u))
        },
        {
          label: $localize`Ban`,
          description: $localize`User won't be able to login anymore, but videos and comments will be kept as is.`,
          handler: users => this.openBanUserModal(users),
          isDisplayed: users => users.every(u => this.authUser.canManage(u) && u.blocked === false)
        },
        {
          label: $localize`Unban`,
          handler: users => this.unbanUsers(users),
          isDisplayed: users => users.every(u => this.authUser.canManage(u) && u.blocked === true)
        }
      ],
      [
        {
          label: $localize`Set Email as Verified`,
          handler: users => this.setEmailsAsVerified(users),
          isDisplayed: users => {
            return users.every(u => this.authUser.canManage(u) && !u.blocked && u.emailVerified !== true)
          }
        }
      ]
    ]

    this.bulkActions = await this.hooks.wrapObject(bulkActions, 'admin-users', 'filter:admin-users-list.bulk-actions.create.result')

    this.columns = [
      { id: 'username', label: $localize`Username` },
      { id: 'role', label: $localize`Role` },
      { id: 'email', label: $localize`Email` },
      { id: 'quota', label: $localize`Video quota` },
      { id: 'totalVideoFileSize', label: $localize`Total size` },
      { id: 'createdAt', label: $localize`Created` },
      { id: 'lastLoginDate', label: $localize`Last login` },

      { id: 'quotaDaily', label: $localize`Daily quota` },
      { id: 'pluginAuth', label: $localize`Auth plugin` }
    ]

    this.loadSelectedColumns()
  }

  ngOnDestroy () {
    this.pluginService.removeAction('admin-users-list:load-data')
  }

  loadSelectedColumns () {
    const result = this.peertubeLocalStorage.getItem(UserListComponent.LS_SELECTED_COLUMNS_KEY)

    if (result) {
      try {
        this.selectedColumns = JSON.parse(result)
        return
      } catch (err) {
        logger.error('Cannot load selected columns.', err)
      }
    }

    // Default behaviour
    this.selectedColumns = [ 'username', 'role', 'email', 'quota', 'totalVideoFileSize', 'createdAt', 'lastLoginDate' ]
    return
  }

  saveSelectedColumns () {
    this.peertubeLocalStorage.setItem(UserListComponent.LS_SELECTED_COLUMNS_KEY, JSON.stringify(this.selectedColumns))
  }

  getIdentifier () {
    return 'UserListComponent'
  }

  getRoleClass (role: UserRoleType) {
    switch (role) {
      case UserRole.ADMINISTRATOR:
        return 'badge-purple'
      case UserRole.MODERATOR:
        return 'badge-blue'
      default:
        return 'badge-yellow'
    }
  }

  isSelected (id: string) {
    return this.selectedColumns.find(c => c === id)
  }

  getColumn (id: string) {
    return this.columns.find(c => c.id === id)
  }

  getUserVideoQuotaPercentage (user: UserForList) {
    return user.rawVideoQuotaUsed * 100 / user.rawVideoQuota
  }

  getUserVideoQuotaDailyPercentage (user: UserForList) {
    return user.rawVideoQuotaUsedDaily * 100 / user.rawVideoQuotaDaily
  }

  openBanUserModal (users: User[]) {
    for (const user of users) {
      if (user.username === 'root') {
        this.notifier.error($localize`You cannot ban root.`)
        return
      }
    }

    this.userBanModal.openModal(users)
  }

  onUserChanged () {
    this.reloadData()
  }

  async unbanUsers (users: User[]) {
    const res = await this.confirmService.confirm(
      formatICU(
        $localize`Do you really want to unban {count, plural, =1 {1 user} other {{count} users}}?`,
        { count: users.length }
      ),
      $localize`Unban`
    )

    if (res === false) return

    this.userAdminService.unbanUsers(users)
        .subscribe({
          next: () => {
            this.notifier.success(
              formatICU(
                $localize`{count, plural, =1 {1 user unbanned.} other {{count} users unbanned.}}`,
                { count: users.length }
              )
            )
            this.reloadData()
          },

          error: err => this.notifier.error(err.message)
        })
  }

  async removeUsers (users: User[]) {
    if (users.some(u => u.username === 'root')) {
      this.notifier.error($localize`You cannot delete root.`)
      return
    }

    const message = $localize`<p>You can't create users or channels with a username that already used by a deleted user/channel.</p>` +
      $localize`It means the following usernames will be permanently deleted and cannot be recovered:` +
      '<ul>' + users.map(u => '<li>' + u.username + '</li>').join('') + '</ul>'

    const res = await this.confirmService.confirm(message, $localize`Delete`)
    if (res === false) return

    this.userAdminService.removeUsers(users)
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {1 user deleted.} other {{count} users deleted.}}`,
              { count: users.length }
            )
          )

          this.reloadData()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  setEmailsAsVerified (users: User[]) {
    this.userAdminService.updateUsers(users, { emailVerified: true })
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {1 user email set as verified.} other {{count} user emails set as verified.}}`,
              { count: users.length }
            )
          )

          this.reloadData()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  protected async reloadDataInternal () {
    const obs = this.userAdminService.getUsers({
      pagination: this.pagination,
      sort: this.sort,
      search: this.search
    })

    try {
      const resultList = await lastValueFrom(obs)

      this.users = resultList.data.map(u => ({
        ...u,

        accountMutedStatus: {
          ...u.account,

          nameWithHost: Actor.CREATE_BY_STRING(u.account.name, u.account.host),

          mutedByInstance: false,
          mutedByUser: false,
          mutedServerByInstance: false,
          mutedServerByUser: false
        }
      }))
      this.totalRecords = resultList.total

      this.loadMutedStatus()
    } catch (err) {
      this.notifier.error(err.message)
    }
  }

  private loadMutedStatus () {
    this.blocklist.getStatus({ accounts: this.users.map(u => u.username + '@' + getAPIHost()) })
      .subscribe(blockStatus => {
        for (const user of this.users) {
          user.accountMutedStatus.mutedByInstance = blockStatus.accounts[user.username + '@' + getAPIHost()].blockedByServer
        }
      })
  }
}
