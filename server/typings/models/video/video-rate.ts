import { AccountVideoRateModel } from '@server/models/account/account-video-rate'
import { PickWith } from '@server/typings/utils'
import { MAccountAudience, MAccountUrl, MVideo } from '..'

export type MAccountVideoRate = Omit<AccountVideoRateModel, 'Video' | 'Account'>

export type MAccountVideoRateAccountUrl = MAccountVideoRate &
  PickWith<AccountVideoRateModel, 'Account', MAccountUrl>

export type MAccountVideoRateAccountVideo = MAccountVideoRate &
  PickWith<AccountVideoRateModel, 'Account', MAccountAudience> &
  PickWith<AccountVideoRateModel, 'Video', MVideo>
