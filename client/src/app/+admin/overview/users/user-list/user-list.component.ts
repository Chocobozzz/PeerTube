import { SortMeta } from 'primeng/api'
import { Component, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, ConfirmService, LocalStorageService, Notifier, RestPagination, RestTable, ServerService } from '@app/core'
import { getAPIHost, prepareIcu } from '@app/helpers'
import { AdvancedInputFilter } from '@app/shared/shared-forms'
import { Actor, DropdownAction } from '@app/shared/shared-main'
import { AccountMutedStatus, BlocklistService, UserBanModalComponent, UserModerationDisplayType } from '@app/shared/shared-moderation'
import { UserAdminService } from '@app/shared/shared-users'
import { logger } from '@root-helpers/logger'
import { User, UserRole } from '@shared/models'

type UserForList = User & {
  rawVideoQuota: number
  rawVideoQuotaUsed: number
  rawVideoQuotaDaily: number
  rawVideoQuotaUsedDaily: number
}

@Component({
  selector: 'my-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: [ './user-list.component.scss' ]
})
export class UserListComponent extends RestTable implements OnInit {
  private static readonly LOCAL_STORAGE_SELECTED_COLUMNS_KEY = 'admin-user-list-selected-columns'

  @ViewChild('userBanModal', { static: true }) userBanModal: UserBanModalComponent

  users: (User & { accountMutedStatus: AccountMutedStatus })[] = []

  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  highlightBannedUsers = false

  selectedUsers: User[] = []
  bulkUserActions: DropdownAction<User[]>[][] = []
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

  requiresEmailVerification = false

  private _selectedColumns: string[] = []

  constructor (
    protected route: ActivatedRoute,
    protected router: Router,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private serverService: ServerService,
    private auth: AuthService,
    private blocklist: BlocklistService,
    private userAdminService: UserAdminService,
    private peertubeLocalStorage: LocalStorageService
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

  ngOnInit () {
    this.serverService.getConfig()
        .subscribe(config => this.requiresEmailVerification = config.signup.requiresEmailVerification)

    this.initialize()

    this.bulkUserActions = [
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
            return this.requiresEmailVerification &&
              users.every(u => this.authUser.canManage(u) && !u.blocked && u.emailVerified === false)
          }
        }
      ]
    ]

    this.columns = [
      { id: 'username', label: $localize`Username` },
      { id: 'role', label: $localize`Role` },
      { id: 'email', label: $localize`Email` },
      { id: 'quota', label: $localize`Video quota` },
      { id: 'createdAt', label: $localize`Created` },
      { id: 'lastLoginDate', label: $localize`Last login` },

      { id: 'quotaDaily', label: $localize`Daily quota` },
      { id: 'pluginAuth', label: $localize`Auth plugin` }
    ]

    this.loadSelectedColumns()
  }

  loadSelectedColumns () {
    const result = this.peertubeLocalStorage.getItem(UserListComponent.LOCAL_STORAGE_SELECTED_COLUMNS_KEY)

    if (result) {
      try {
        this.selectedColumns = JSON.parse(result)
        return
      } catch (err) {
        logger.error('Cannot load selected columns.', err)
      }
    }

    // Default behaviour
    this.selectedColumns = [ 'username', 'role', 'email', 'quota', 'createdAt', 'lastLoginDate' ]
    return
  }

  saveSelectedColumns () {
    this.peertubeLocalStorage.setItem(UserListComponent.LOCAL_STORAGE_SELECTED_COLUMNS_KEY, JSON.stringify(this.selectedColumns))
  }

  getIdentifier () {
    return 'UserListComponent'
  }

  getRoleClass (role: UserRole) {
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
      prepareIcu($localize`Do you really want to unban {count, plural, =1 {1 user} other {{count} users}}?`)(
        { count: users.length },
        $localize`Do you really want to unban ${users.length} users?`
      ),
      $localize`Unban`
    )

    if (res === false) return

    this.userAdminService.unbanUsers(users)
        .subscribe({
          next: () => {
            this.notifier.success(
              prepareIcu($localize`{count, plural, =1 {1 user unbanned.} other {{count} users unbanned.}}`)(
                { count: users.length },
                $localize`${users.length} users unbanned.`
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

    this.userAdminService.removeUser(users)
      .subscribe({
        next: () => {
          this.notifier.success(
            prepareIcu($localize`{count, plural, =1 {1 user deleted.} other {{count} users deleted.}}`)(
              { count: users.length },
              $localize`${users.length} users deleted.`
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
            prepareIcu($localize`{count, plural, =1 {1 user email set as verified.} other {{count} user emails set as verified.}}`)(
              { count: users.length },
              $localize`${users.length} users email set as verified.`
            )
          )

          this.reloadData()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  isInSelectionMode () {
    return this.selectedUsers.length !== 0
  }

  protected reloadData () {
    this.selectedUsers = []

    this.userAdminService.getUsers({
      pagination: this.pagination,
      sort: this.sort,
      search: this.search
    }).subscribe({
      next: resultList => {
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
      },

      error: err => this.notifier.error(err.message)
    })
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
