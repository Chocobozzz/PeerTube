import { CommonModule, NgClass } from '@angular/common'
import { Component, OnDestroy, OnInit, inject, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { AuthService, ConfirmService, HooksService, Notifier, PluginService, UserService } from '@app/core'
import { formatICU, getBackendHost } from '@app/helpers'
import { Actor } from '@app/shared/shared-main/account/actor.model'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { ProgressBarComponent } from '@app/shared/shared-main/common/progress-bar.component'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { UserBanModalComponent } from '@app/shared/shared-moderation/user-ban-modal.component'
import { UserAdmin, UserAdminService } from '@app/shared/shared-users/user-admin.service'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { UserRole, UserRoleType } from '@peertube/peertube-models'
import { map, switchMap } from 'rxjs'
import { ActorAvatarComponent } from '../../../../shared/shared-actor-image/actor-avatar.component'
import { AdvancedInputFilter, AdvancedInputFilterComponent } from '../../../../shared/shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../../../../shared/shared-icons/global-icon.component'
import { DropdownAction } from '../../../../shared/shared-main/buttons/action-dropdown.component'
import { BytesPipe } from '../../../../shared/shared-main/common/bytes.pipe'
import { NumberFormatterPipe } from '../../../../shared/shared-main/common/number-formatter.pipe'
import {
  AccountMutedStatus,
  UserModerationDisplayType,
  UserModerationDropdownComponent
} from '../../../../shared/shared-moderation/user-moderation-dropdown.component'
import { DataLoaderOptions, TableColumnInfo, TableComponent } from '../../../../shared/shared-tables/table.component'
import { UserEmailInfoComponent } from '../../../shared/user-email-info.component'

type User = UserAdmin & { accountMutedStatus: AccountMutedStatus }

type ColumnName =
  | 'username'
  | 'role'
  | 'email'
  | 'videoQuotaUsed'
  | 'videoQuotaDailyUsed'
  | 'totalVideoFileSize'
  | 'createdAt'
  | 'lastLoginDate'
  | 'twoFactorEnabled'
  | 'pluginAuth'

@Component({
  selector: 'my-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: [ './user-list.component.scss' ],
  imports: [
    GlobalIconComponent,
    CommonModule,
    RouterLink,
    AdvancedInputFilterComponent,
    FormsModule,
    NgbTooltip,
    NgClass,
    UserModerationDropdownComponent,
    ActorAvatarComponent,
    UserEmailInfoComponent,
    UserBanModalComponent,
    PTDatePipe,
    BytesPipe,
    ProgressBarComponent,
    TableComponent,
    NumberFormatterPipe
  ]
})
export class UserListComponent implements OnInit, OnDestroy {
  private notifier = inject(Notifier)
  private confirmService = inject(ConfirmService)
  private auth = inject(AuthService)
  private blocklist = inject(BlocklistService)
  private userAdminService = inject(UserAdminService)
  private hooks = inject(HooksService)
  private pluginService = inject(PluginService)
  private userService = inject(UserService)

  readonly userBanModal = viewChild<UserBanModalComponent>('userBanModal')
  readonly table = viewChild<TableComponent<User, ColumnName>>('table')

  bulkActions: DropdownAction<User[]>[][] = []

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

  columns: TableColumnInfo<ColumnName>[] = [
    { id: 'username', label: $localize`Username`, sortable: true },
    { id: 'role', label: $localize`Role`, sortable: true },
    { id: 'email', label: $localize`Email`, sortable: false },
    { id: 'videoQuotaUsed', label: $localize`Video quota`, sortable: true },
    { id: 'videoQuotaDailyUsed', label: $localize`Daily quota`, sortable: false },
    { id: 'totalVideoFileSize', label: $localize`Total size`, sortable: false },
    { id: 'twoFactorEnabled', label: $localize`2FA`, sortable: false },
    { id: 'pluginAuth', label: $localize`Auth plugin`, sortable: false },
    { id: 'createdAt', label: $localize`Created`, sortable: true },
    { id: 'lastLoginDate', label: $localize`Last login`, sortable: true }
  ]

  dataLoader: typeof this._dataLoader
  hasExpandedRow: typeof this._hasExpandedRow

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)
    this.hasExpandedRow = this._hasExpandedRow.bind(this)
  }

  get authUser () {
    return this.auth.getUser()
  }

  async ngOnInit () {
    this.pluginService.addAction('admin-users-list:load-data', () => this.table().loadData())

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
          label: $localize`Set email as verified`,
          handler: users => this.setEmailsAsVerified(users),
          isDisplayed: users => {
            return users.every(u => this.authUser.canManage(u) && !u.blocked && u.emailVerified !== true)
          }
        },
        {
          label: $localize`Re-send verification emails`,
          handler: users => this.resendVerificationEmails(users),
          isDisplayed: users => {
            return users.every(u => this.authUser.canManage(u) && !u.blocked && u.emailVerified !== true && !u.pluginAuth)
          }
        }
      ]
    ]

    this.bulkActions = await this.hooks.wrapObject(bulkActions, 'admin-users', 'filter:admin-users-list.bulk-actions.create.result')
  }

  ngOnDestroy () {
    this.pluginService.removeAction('admin-users-list:load-data')
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

  openBanUserModal (users: User[]) {
    for (const user of users) {
      if (user.username === 'root') {
        this.notifier.error($localize`You cannot ban root.`)
        return
      }
    }

    this.userBanModal().openModal(users)
  }

  onUserChanged () {
    this.table().loadData()
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
          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
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

          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
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

          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  resendVerificationEmails (users: User[]) {
    this.userService.askSendVerifyEmail(users.map(u => u.email))
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {1 verification email sent.} other {{count} verification emails sent.}}`,
              { count: users.length }
            )
          )
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private _dataLoader (options: DataLoaderOptions) {
    return this.userAdminService.listUsers(options)
      .pipe(
        switchMap(result => {
          return this.blocklist.getStatus({ accounts: result.data.map(u => u.username + '@' + getBackendHost()) })
            .pipe(map(blockStatus => ({ result, blockStatus })))
        }),
        map(({ result, blockStatus }) => ({
          total: result.total,

          data: result.data.map(u => ({
            ...u,

            accountMutedStatus: {
              ...u.account,

              nameWithHost: Actor.CREATE_BY_STRING(u.account.name, u.account.host),

              mutedByInstance: blockStatus.accounts[u.username + '@' + getBackendHost()].blockedByServer,
              mutedByUser: false,
              mutedServerByInstance: false,
              mutedServerByUser: false
            }
          }))
        }))
      )
  }

  private _hasExpandedRow (user: User) {
    return !!user.blockedReason
  }
}
