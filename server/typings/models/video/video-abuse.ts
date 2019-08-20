import { VideoAbuseModel } from '../../../models/video/video-abuse'
import { PickWith } from '../../utils'
import { MVideo } from './video'
import { MAccountDefault } from '../account'

type Use<K extends keyof VideoAbuseModel, M> = PickWith<VideoAbuseModel, K, M>

// ############################################################################

export type MVideoAbuse = Omit<VideoAbuseModel, 'Account' | 'Video' | 'toActivityPubObject'>

// ############################################################################

export type MVideoAbuseId = Pick<VideoAbuseModel, 'id'>

export type MVideoAbuseVideo = MVideoAbuse &
  Pick<VideoAbuseModel, 'toActivityPubObject'> &
  Use<'Video', MVideo>

export type MVideoAbuseAccountVideo = MVideoAbuse &
  Pick<VideoAbuseModel, 'toActivityPubObject'> &
  Use<'Video', MVideo> &
  Use<'Account', MAccountDefault>
