import { VideoAbuseModel } from '../../../models/video/video-abuse'
import { PickWith } from '../../utils'
import { MVideoAccountLightBlacklistAllFiles, MVideo } from './video'
import { MAccountDefault, MAccountFormattable } from '../account'

type Use<K extends keyof VideoAbuseModel, M> = PickWith<VideoAbuseModel, K, M>

// ############################################################################

export type MVideoAbuse = Omit<VideoAbuseModel, 'Account' | 'Video' | 'toActivityPubObject'>

// ############################################################################

export type MVideoAbuseId = Pick<VideoAbuseModel, 'id'>

export type MVideoAbuseVideo =
  MVideoAbuse &
  Pick<VideoAbuseModel, 'toActivityPubObject'> &
  Use<'Video', MVideo>

export type MVideoAbuseAccountVideo =
  MVideoAbuse &
  Pick<VideoAbuseModel, 'toActivityPubObject'> &
  Use<'Video', MVideoAccountLightBlacklistAllFiles> &
  Use<'Account', MAccountDefault>

// ############################################################################

// Format for API or AP object

export type MVideoAbuseFormattable =
  MVideoAbuse &
  Use<'Account', MAccountFormattable> &
  Use<'Video', Pick<MVideoAccountLightBlacklistAllFiles,
  'id' | 'uuid' | 'name' | 'nsfw' | 'getMiniatureStaticPath' | 'isBlacklisted' | 'VideoChannel'>>
