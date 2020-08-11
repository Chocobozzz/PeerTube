import { SortMeta } from 'primeng/api'
import { Component, OnInit, ViewChild } from '@angular/core'
import { AuthService, ConfirmService, Notifier, RestPagination, RestTable, ServerService, UserService } from '@app/core'
import { Actor, DropdownAction } from '@app/shared/shared-main'
import { UserBanModalComponent } from '@app/shared/shared-moderation'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ServerConfig, User, UserRole } from '@shared/models'
import { Params, Router, ActivatedRoute } from '@angular/router'

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
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private serverService: ServerService,
    private userService: UserService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private i18n: I18n
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

    this.route.queryParams
      .subscribe(params => {
        this.search = params.search || ''

        this.setTableFilter(this.search)
        this.loadData()
      })

    this.bulkUserActions = [
      [
        {
          label: this.i18n('Delete'),
          description: this.i18n('Videos will be deleted, comments will be tombstoned.'),
          handler: users => this.removeUsers(users),
          isDisplayed: users => users.every(u => this.authUser.canManage(u))
        },
        {
          label: this.i18n('Ban'),
          description: this.i18n('User won\'t be able to login anymore, but videos and comments will be kept as is.'),
          handler: users => this.openBanUserModal(users),
          isDisplayed: users => users.every(u => this.authUser.canManage(u) && u.blocked === false)
        },
        {
          label: this.i18n('Unban'),
          handler: users => this.unbanUsers(users),
          isDisplayed: users => users.every(u => this.authUser.canManage(u) && u.blocked === true)
        }
      ],
      [
        {
          label: this.i18n('Set Email as Verified'),
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
        this.notifier.error(this.i18n('You cannot ban root.'))
        return
      }
    }

    this.userBanModal.openModal(users)
  }

  onUserChanged () {
    this.loadData()
  }

  /* Table filter functions */
  onUserSearch (event: Event) {
    this.onSearch(event)
    this.setQueryParams((event.target as HTMLInputElement).value)
  }

  setQueryParams (search: string) {
    const queryParams: Params = {}
    if (search) Object.assign(queryParams, { search })

    this.router.navigate([ '/admin/users/list' ], { queryParams })
  }

  resetTableFilter () {
    this.setTableFilter('')
    this.setQueryParams('')
    this.resetSearch()
  }
  /* END Table filter functions */

  switchToDefaultAvatar ($event: Event) {
    ($event.target as HTMLImageElement).src = Actor.GET_DEFAULT_AVATAR_URL()
  }

  async unbanUsers (users: User[]) {
    const message = this.i18n('Do you really want to unban {{num}} users?', { num: users.length })

    const res = await this.confirmService.confirm(message, this.i18n('Unban'))
    if (res === false) return

    this.userService.unbanUsers(users)
        .subscribe(
          () => {
            const message = this.i18n('{{num}} users unbanned.', { num: users.length })

            this.notifier.success(message)
            this.loadData()
          },

          err => this.notifier.error(err.message)
        )
  }

  async removeUsers (users: User[]) {
    for (const user of users) {
      if (user.username === 'root') {
        this.notifier.error(this.i18n('You cannot delete root.'))
        return
      }
    }

    const message = this.i18n('If you remove these users, you will not be able to create others with the same username!')
    const res = await this.confirmService.confirm(message, this.i18n('Delete'))
    if (res === false) return

    this.userService.removeUser(users).subscribe(
      () => {
        this.notifier.success(this.i18n('{{num}} users deleted.', { num: users.length }))
        this.loadData()
      },

      err => this.notifier.error(err.message)
    )
  }

  async setEmailsAsVerified (users: User[]) {
    this.userService.updateUsers(users, { emailVerified: true }).subscribe(
      () => {
        this.notifier.success(this.i18n('{{num}} users email set as verified.', { num: users.length }))
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
