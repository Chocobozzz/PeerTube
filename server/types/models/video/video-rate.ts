import { AccountVideoRateModel } from '@server/models/account/account-video-rate'
import { PickWith } from '@shared/core-utils'
import { MAccountAudience, MAccountUrl } from '../account/account'
import { MVideo, MVideoFormattable } from './video'

type Use<K extends keyof AccountVideoRateModel, M> = PickWith<AccountVideoRateModel, K, M>

// ############################################################################

export type MAccountVideoRate = Omit<AccountVideoRateModel, 'Video' | 'Account'>

export type MAccountVideoRateAccountUrl =
  MAccountVideoRate &
  Use<'Account', MAccountUrl>

export type MAccountVideoRateAccountVideo =
  MAccountVideoRate &
  Use<'Account', MAccountAudience> &
  Use<'Video', MVideo>

// ############################################################################

// Format for API or AP object

export type MAccountVideoRateFormattable =
  Pick<MAccountVideoRate, 'type'> &
  Use<'Video', MVideoFormattable>
