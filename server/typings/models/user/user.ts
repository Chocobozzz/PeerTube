import { UserModel } from '../../../models/account/user'
import { PickWith } from '../../utils'
import { MAccount, MAccountDefault, MAccountDefaultChannelDefault, MAccountId, MAccountIdActorId, MAccountUrl } from '../account'
import { MNotificationSetting } from './user-notification-setting'

type Use<K extends keyof UserModel, M> = PickWith<UserModel, K, M>

// ############################################################################

export type MUser = Omit<UserModel, 'Account' | 'NotificationSetting' | 'VideoImports' | 'OAuthTokens'>

// ############################################################################

export type MUserId = Pick<UserModel, 'id'>

// ############################################################################

// With account

export type MUserAccountId = MUser &
  Use<'Account', MAccountId>

export type MUserAccountUrl = MUser &
  Use<'Account', MAccountUrl & MAccountIdActorId>

export type MUserAccount = MUser &
  Use<'Account', MAccount>

export type MUserAccountDefault = MUser &
  Use<'Account', MAccountDefault>

// With channel

export type MUserNotifSettingChannelDefault = MUser &
  Use<'NotificationSetting', MNotificationSetting> &
  Use<'Account', MAccountDefaultChannelDefault>

// With notification settings

export type MUserWithNotificationSetting = MUser &
  Use<'NotificationSetting', MNotificationSetting>

export type MUserNotifSettingAccount = MUser &
  Use<'NotificationSetting', MNotificationSetting> &
  Use<'Account', MAccount>

// Default scope

export type MUserDefault = MUser &
  Use<'NotificationSetting', MNotificationSetting> &
  Use<'Account', MAccountDefault>
