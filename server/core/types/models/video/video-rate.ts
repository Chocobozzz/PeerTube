import { AccountVideoRateModel } from '@server/models/account/account-video-rate.js'
import { PickWith } from '@peertube/peertube-typescript-utils'
import { MAccountAudience, MAccountUrl } from '../account/account.js'
import { MVideo, MVideoFormattable, MVideoUrl } from './video.js'

type Use<K extends keyof AccountVideoRateModel, M> = PickWith<AccountVideoRateModel, K, M>

// ############################################################################

export type MAccountVideoRate = Omit<AccountVideoRateModel, 'Video' | 'Account'>

export type MAccountVideoRateVideoUrl =
  MAccountVideoRate &
  Use<'Video', MVideoUrl>

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
