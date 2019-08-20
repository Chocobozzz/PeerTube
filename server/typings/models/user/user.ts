import { UserModel } from '../../../models/account/user'
import { PickWith, PickWithOpt } from '../../utils'
import {
  MAccount,
  MAccountDefault,
  MAccountDefaultChannelDefault,
  MAccountFormattable,
  MAccountId,
  MAccountIdActorId,
  MAccountUrl
} from '../account'
import { MNotificationSetting, MNotificationSettingFormattable } from './user-notification-setting'
import { AccountModel } from '@server/models/account/account'
import { MChannelFormattable } from '@server/typings/models'

type Use<K extends keyof UserModel, M> = PickWith<UserModel, K, M>

// ############################################################################

export type MUser = Omit<UserModel, 'Account' | 'NotificationSetting' | 'VideoImports' | 'OAuthTokens'>

// ############################################################################

export type MUserQuotaUsed = MUser & { videoQuotaUsed?: number, videoQuotaUsedDaily?: number }
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

// ############################################################################

// Format for API or AP object

export type MUserFormattable = MUserQuotaUsed &
  Use<'Account', MAccountFormattable & PickWithOpt<AccountModel, 'VideoChannels', MChannelFormattable[]>> &
  PickWithOpt<UserModel, 'NotificationSetting', MNotificationSettingFormattable>
