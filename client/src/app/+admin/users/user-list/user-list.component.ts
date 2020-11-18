import { SortMeta } from 'primeng/api'
import { Component, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Params, Router } from '@angular/router'
import { AuthService, ConfirmService, Notifier, RestPagination, RestTable, ServerService, UserService } from '@app/core'
import { Account, DropdownAction } from '@app/shared/shared-main'
import { UserBanModalComponent } from '@app/shared/shared-moderation'
import { ServerConfig, User, UserRole } from '@shared/models'

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
  @ViewChild('userBanModal', { static: true }) userBanModal: UserBanModalComponent

  users: User[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }
  highlightBannedUsers = false

  selectedUsers: User[] = []
  bulkUserActions: DropdownAction<User[]>[][] = []
  columns: { id: string, label: string }[]

  private _selectedColumns: string[]
  private serverConfig: ServerConfig

  constructor (
    protected route: ActivatedRoute,
    protected router: Router,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private serverService: ServerService,
    private auth: AuthService,
    private userService: UserService
  ) {
    super()
  }

  get authUser () {
    return this.auth.getUser()
  }

  get requiresEmailVerification () {
    return this.serverConfig.signup.requiresEmailVerification
  }

  get selectedColumns () {
    return this._selectedColumns
  }

  set selectedColumns (val: string[]) {
    this._selectedColumns = val
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
        .subscribe(config => this.serverConfig = config)

    this.initialize()
    this.listenToSearchChange()

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
      { id: 'username', label: 'Username' },
      { id: 'email', label: 'Email' },
      { id: 'quota', label: 'Video quota' },
      { id: 'role', label: 'Role' },
      { id: 'createdAt', label: 'Created' }
    ]

    this.selectedColumns = this.columns.map(c => c.id)

    this.columns.push({ id: 'quotaDaily', label: 'Daily quota' })
    this.columns.push({ id: 'pluginAuth', label: 'Auth plugin' })
    this.columns.push({ id: 'lastLoginDate', label: 'Last login' })
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
    this.loadData()
  }

  switchToDefaultAvatar ($event: Event) {
    ($event.target as HTMLImageElement).src = Account.GET_DEFAULT_AVATAR_URL()
  }

  async unbanUsers (users: User[]) {
    const res = await this.confirmService.confirm($localize`Do you really want to unban ${users.length} users?`, $localize`Unban`)
    if (res === false) return

    this.userService.unbanUsers(users)
        .subscribe(
          () => {
            this.notifier.success($localize`${users.length} users unbanned.`)
            this.loadData()
          },

          err => this.notifier.error(err.message)
        )
  }

  async removeUsers (users: User[]) {
    for (const user of users) {
      if (user.username === 'root') {
        this.notifier.error($localize`You cannot delete root.`)
        return
      }
    }

    const message = $localize`If you remove these users, you will not be able to create others with the same username!`
    const res = await this.confirmService.confirm(message, $localize`Delete`)
    if (res === false) return

    this.userService.removeUser(users).subscribe(
      () => {
        this.notifier.success($localize`${users.length} users deleted.`)
        this.loadData()
      },

      err => this.notifier.error(err.message)
    )
  }

  async setEmailsAsVerified (users: User[]) {
    this.userService.updateUsers(users, { emailVerified: true }).subscribe(
      () => {
        this.notifier.success($localize`${users.length} users email set as verified.`)
        this.loadData()
      },

      err => this.notifier.error(err.message)
    )
  }

  isInSelectionMode () {
    return this.selectedUsers.length !== 0
  }

  protected loadData () {
    this.selectedUsers = []

    this.userService.getUsers({
      pagination: this.pagination,
      sort: this.sort,
      search: this.search
    }).subscribe(
      resultList => {
        this.users = resultList.data
        this.totalRecords = resultList.total
      },

      err => this.notifier.error(err.message)
    )
  }
}
