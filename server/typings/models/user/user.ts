import { UserModel } from '../../../models/account/user'
import { PickWith } from '../../utils'
import { MAccount, MAccountDefault, MAccountDefaultChannelDefault, MAccountId, MAccountIdActorId, MAccountUrl } from '../account'
import { MNotificationSetting } from './user-notification-setting'

export type MUser = Omit<UserModel, 'Account' | 'NotificationSetting' | 'VideoImports' | 'OAuthTokens'>

export type MUserId = Pick<UserModel, 'id'>

export type MUserWithNotificationSetting = MUser &
  PickWith<UserModel, 'NotificationSetting', MNotificationSetting>

export type MUserAccountDefault = MUser &
  PickWith<UserModel, 'Account', MAccountDefault>

export type MUserAccount = MUser &
  PickWith<UserModel, 'Account', MAccount>

export type MUserAccountId = MUser &
  PickWith<UserModel, 'Account', MAccountId>

export type MUserNotifSettingAccount = MUserWithNotificationSetting & MUserAccount

export type MUserDefault = MUser &
  MUserWithNotificationSetting &
  MUserAccountDefault

export type MUserChannel = MUserWithNotificationSetting &
  PickWith<UserModel, 'Account', MAccountDefaultChannelDefault>

export type MUserAccountUrl = MUser &
  PickWith<UserModel, 'Account', MAccountUrl & MAccountIdActorId>
