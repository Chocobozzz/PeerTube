import { Component, EventEmitter, Input, OnChanges, OnInit, Output, ViewChild } from '@angular/core'
import { AuthService, ConfirmService, Notifier, ServerService } from '@app/core'
import { BulkRemoveCommentsOfBody, User, UserRight } from '@peertube/peertube-models'
import { BlocklistService } from './blocklist.service'
import { BulkService } from './bulk.service'
import { UserBanModalComponent } from './user-ban-modal.component'
import { ActionDropdownComponent, DropdownAction } from '../shared-main/buttons/action-dropdown.component'
import { NgIf } from '@angular/common'
import { Account } from '../shared-main/account/account.model'
import { UserAdminService } from '../shared-users/user-admin.service'

export type AccountMutedStatus =
  Pick<Account, 'id' | 'nameWithHost' | 'host' | 'userId' |
  'mutedByInstance' | 'mutedByUser' | 'mutedServerByInstance' | 'mutedServerByUser'>

export type UserModerationDisplayType = {
  myAccount?: boolean
  instanceAccount?: boolean
  instanceUser?: boolean
}

@Component({
  selector: 'my-user-moderation-dropdown',
  templateUrl: './user-moderation-dropdown.component.html',
  standalone: true,
  imports: [ NgIf, UserBanModalComponent, ActionDropdownComponent ]
})
export class UserModerationDropdownComponent implements OnInit, OnChanges {
  @ViewChild('userBanModal') userBanModal: UserBanModalComponent

  @Input() user: User
  @Input() account: AccountMutedStatus
  @Input() prependActions: DropdownAction<{ user: User, account: AccountMutedStatus }>[]

  @Input() buttonSize: 'normal' | 'small' = 'normal'
  @Input() buttonStyled = true
  @Input() placement = 'right-top right-bottom auto'
  @Input() label: string
  @Input() container: 'body' | undefined = undefined

  @Input() displayOptions: UserModerationDisplayType = {
    myAccount: true,
    instanceAccount: true,
    instanceUser: true
  }

  @Output() userChanged = new EventEmitter()
  @Output() userDeleted = new EventEmitter()

  userActions: DropdownAction<{ user: User, account: AccountMutedStatus }>[][] = []

  requiresEmailVerification = false

  constructor (
    private authService: AuthService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private serverService: ServerService,
    private userAdminService: UserAdminService,
    private blocklistService: BlocklistService,
    private bulkService: BulkService
  ) { }

  ngOnInit () {
    this.serverService.getConfig()
      .subscribe(config => this.requiresEmailVerification = config.signup.requiresEmailVerification)
  }

  ngOnChanges () {
    this.buildActions()
  }

  openBanUserModal (user: User) {
    if (user.username === 'root') {
      this.notifier.error($localize`You cannot ban root.`)
      return
    }

    this.userBanModal.openModal(user)
  }

  onUserBanned () {
    this.userChanged.emit()
  }

  async unbanUser (user: User) {
    const res = await this.confirmService.confirm($localize`Do you really want to unban ${user.username}?`, $localize`Unban`)
    if (res === false) return

    this.userAdminService.unbanUsers(user)
        .subscribe({
          next: () => {
            this.notifier.success($localize`User ${user.username} unbanned.`)
            this.userChanged.emit()
          },

          error: err => this.notifier.error(err.message)
        })
  }

  async removeUser (user: User) {
    if (user.username === 'root') {
      this.notifier.error($localize`You cannot delete root.`)
      return
    }

    // eslint-disable-next-line max-len
    const message = $localize`If you remove this user, you won't be able to create another user or channel with <strong>${user.username}</strong> username!`
    const res = await this.confirmService.confirm(message, $localize`Delete ${user.username}`)
    if (res === false) return

    this.userAdminService.removeUsers(user)
      .subscribe({
        next: () => {
          this.notifier.success($localize`User ${user.username} deleted.`)
          this.userDeleted.emit()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  setEmailAsVerified (user: User) {
    this.userAdminService.updateUser(user.id, { emailVerified: true })
      .subscribe({
        next: () => {
          this.notifier.success($localize`User ${user.username} email set as verified`)
          this.userChanged.emit()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  blockAccountByUser (account: AccountMutedStatus) {
    this.blocklistService.blockAccountByUser(account)
        .subscribe({
          next: () => {
            this.notifier.success($localize`Account ${account.nameWithHost} muted.`)

            this.account.mutedByUser = true
            this.userChanged.emit()
          },

          error: err => this.notifier.error(err.message)
        })
  }

  unblockAccountByUser (account: AccountMutedStatus) {
    this.blocklistService.unblockAccountByUser(account)
        .subscribe({
          next: () => {
            this.notifier.success($localize`Account ${account.nameWithHost} unmuted.`)

            this.account.mutedByUser = false
            this.userChanged.emit()
          },

          error: err => this.notifier.error(err.message)
        })
  }

  blockServerByUser (host: string) {
    this.blocklistService.blockServerByUser(host)
        .subscribe({
          next: () => {
            this.notifier.success($localize`Instance ${host} muted.`)

            this.account.mutedServerByUser = true
            this.userChanged.emit()
          },

          error: err => this.notifier.error(err.message)
        })
  }

  unblockServerByUser (host: string) {
    this.blocklistService.unblockServerByUser(host)
        .subscribe({
          next: () => {
            this.notifier.success($localize`Instance ${host} unmuted.`)

            this.account.mutedServerByUser = false
            this.userChanged.emit()
          },

          error: err => this.notifier.error(err.message)
        })
  }

  blockAccountByInstance (account: AccountMutedStatus) {
    this.blocklistService.blockAccountByInstance(account)
        .subscribe({
          next: () => {
            this.notifier.success($localize`Account ${account.nameWithHost} muted by the instance.`)

            this.account.mutedByInstance = true
            this.userChanged.emit()
          },

          error: err => this.notifier.error(err.message)
        })
  }

  unblockAccountByInstance (account: AccountMutedStatus) {
    this.blocklistService.unblockAccountByInstance(account)
        .subscribe({
          next: () => {
            this.notifier.success($localize`Account ${account.nameWithHost} unmuted by the instance.`)

            this.account.mutedByInstance = false
            this.userChanged.emit()
          },

          error: err => this.notifier.error(err.message)
        })
  }

  blockServerByInstance (host: string) {
    this.blocklistService.blockServerByInstance(host)
        .subscribe({
          next: () => {
            this.notifier.success($localize`Instance ${host} muted by the instance.`)

            this.account.mutedServerByInstance = true
            this.userChanged.emit()
          },

          error: err => this.notifier.error(err.message)
        })
  }

  unblockServerByInstance (host: string) {
    this.blocklistService.unblockServerByInstance(host)
        .subscribe({
          next: () => {
            this.notifier.success($localize`Instance ${host} unmuted by the instance.`)

            this.account.mutedServerByInstance = false
            this.userChanged.emit()
          },

          error: err => this.notifier.error(err.message)
        })
  }

  async bulkRemoveCommentsOf (body: BulkRemoveCommentsOfBody) {
    const message = $localize`Are you sure you want to remove all the comments of this account?`
    const res = await this.confirmService.confirm(message, $localize`Delete account comments`)
    if (res === false) return

    this.bulkService.removeCommentsOf(body)
        .subscribe({
          next: () => {
            this.notifier.success($localize`Will remove comments of this account (may take several minutes).`)
          },

          error: err => this.notifier.error(err.message)
        })
  }

  getRouterUserEditLink (user: User) {
    return [ '/admin', 'users', 'update', user.id ]
  }

  private isMyUser (user: User) {
    return user && this.authService.getUser().id === user.id
  }

  private isMyAccount (account: AccountMutedStatus) {
    return account && this.authService.getUser().account.id === account.id
  }

  private buildActions () {
    this.userActions = []

    if (this.prependActions && this.prependActions.length !== 0) {
      this.userActions = [
        this.prependActions
      ]
    }

    const myAccountModerationActions = this.buildMyAccountModerationActions()
    const instanceModerationActions = this.buildInstanceModerationActions()

    if (myAccountModerationActions.length !== 0) this.userActions.push(myAccountModerationActions)
    if (instanceModerationActions.length !== 0) this.userActions.push(instanceModerationActions)
  }

  private buildMyAccountModerationActions () {
    if (!this.account || !this.displayOptions.myAccount || !this.authService.isLoggedIn()) return []

    const myAccountActions: DropdownAction<{ user: User, account: AccountMutedStatus }>[] = [
      {
        label: $localize`My account moderation`,
        class: [ 'red' ],
        isHeader: true
      },
      {
        label: $localize`Mute this account`,
        description: $localize`Hide any content from that user from you.`,
        isDisplayed: ({ account }) => !this.isMyAccount(account) && account.mutedByUser === false,
        handler: ({ account }) => this.blockAccountByUser(account)
      },
      {
        label: $localize`Unmute this account`,
        description: $localize`Show back content from that user for you.`,
        isDisplayed: ({ account }) => !this.isMyAccount(account) && account.mutedByUser === true,
        handler: ({ account }) => this.unblockAccountByUser(account)
      },
      {
        label: $localize`Mute the instance`,
        description: $localize`Hide any content from that instance for you.`,
        isDisplayed: ({ account }) => !account.userId && account.mutedServerByUser === false,
        handler: ({ account }) => this.blockServerByUser(account.host)
      },
      {
        label: $localize`Unmute the instance`,
        description: $localize`Show back content from that instance for you.`,
        isDisplayed: ({ account }) => !account.userId && account.mutedServerByUser === true,
        handler: ({ account }) => this.unblockServerByUser(account.host)
      },
      {
        label: $localize`Remove comments from your videos`,
        description: $localize`Remove comments made by this account on your videos.`,
        isDisplayed: ({ account }) => !this.isMyAccount(account),
        handler: ({ account }) => this.bulkRemoveCommentsOf({ accountName: account.nameWithHost, scope: 'my-videos' })
      }
    ]

    return myAccountActions
  }

  private buildInstanceModerationActions () {
    if (!this.authService.isLoggedIn()) return []

    const authUser = this.authService.getUser()

    let instanceActions: DropdownAction<{ user: User, account: AccountMutedStatus }>[] = []

    if (this.user && this.displayOptions.instanceUser && authUser.hasRight(UserRight.MANAGE_USERS) && authUser.canManage(this.user)) {
      instanceActions = instanceActions.concat([
        {
          label: $localize`Edit user`,
          description: $localize`Change quota, role, and more.`,
          linkBuilder: ({ user }) => this.getRouterUserEditLink(user)
        },
        {
          label: $localize`Delete user`,
          description: $localize`Videos will be deleted, comments will be tombstoned.`,
          isDisplayed: ({ user }) => !this.isMyUser(user),
          handler: ({ user }) => this.removeUser(user)
        },
        {
          label: $localize`Ban`,
          description: $localize`User won't be able to login anymore, but videos and comments will be kept as is.`,
          handler: ({ user }) => this.openBanUserModal(user),
          isDisplayed: ({ user }) => !this.isMyUser(user) && !user.blocked
        },
        {
          label: $localize`Unban user`,
          description: $localize`Allow the user to login and create videos/comments again`,
          handler: ({ user }) => this.unbanUser(user),
          isDisplayed: ({ user }) => !this.isMyUser(user) && user.blocked
        },
        {
          label: $localize`Set Email as Verified`,
          handler: ({ user }) => this.setEmailAsVerified(user),
          isDisplayed: ({ user }) => !user.blocked && user.emailVerified !== true
        }
      ])
    }

    // Instance actions on account blocklists
    if (this.account && this.displayOptions.instanceAccount && authUser.hasRight(UserRight.MANAGE_ACCOUNTS_BLOCKLIST)) {
      instanceActions = instanceActions.concat([
        {
          label: $localize`Mute this account`,
          description: $localize`Hide any content from that user from you, your instance and its users.`,
          isDisplayed: ({ account }) => !this.isMyAccount(account) && account.mutedByInstance === false,
          handler: ({ account }) => this.blockAccountByInstance(account)
        },
        {
          label: $localize`Unmute this account`,
          description: $localize`Show this user's content to the users of this instance again.`,
          isDisplayed: ({ account }) => !this.isMyAccount(account) && account.mutedByInstance === true,
          handler: ({ account }) => this.unblockAccountByInstance(account)
        }
      ])
    }

    // Instance actions on server blocklists
    if (this.account && this.displayOptions.instanceAccount && authUser.hasRight(UserRight.MANAGE_SERVERS_BLOCKLIST)) {
      instanceActions = instanceActions.concat([
        {
          label: $localize`Mute the instance`,
          description: $localize`Hide any content from that instance from you, your instance and its users.`,
          isDisplayed: ({ account }) => !account.userId && account.mutedServerByInstance === false,
          handler: ({ account }) => this.blockServerByInstance(account.host)
        },
        {
          label: $localize`Unmute the instance by your instance`,
          description: $localize`Show back content from that instance for you, your instance and its users.`,
          isDisplayed: ({ account }) => !account.userId && account.mutedServerByInstance === true,
          handler: ({ account }) => this.unblockServerByInstance(account.host)
        }
      ])
    }

    if (this.account && this.displayOptions.instanceAccount && authUser.hasRight(UserRight.MANAGE_ANY_VIDEO_COMMENT)) {
      instanceActions = instanceActions.concat([
        {
          label: $localize`Remove comments from your instance`,
          description: $localize`Remove comments made by this account from your instance.`,
          isDisplayed: ({ account }) => !this.isMyAccount(account),
          handler: ({ account }) => this.bulkRemoveCommentsOf({ accountName: account.nameWithHost, scope: 'instance' })
        }
      ])
    }

    if (instanceActions.length === 0) return []

    return [ { label: $localize`Instance moderation`, isHeader: true }, ...instanceActions ]
  }
}
