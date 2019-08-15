import { VideoAbuseModel } from '../../../models/video/video-abuse'
import { PickWith } from '../../utils'
import { MVideo } from './video'
import { MAccountDefault } from '../account'

export type MVideoAbuse = Omit<VideoAbuseModel, 'Account' | 'Video' | 'toActivityPubObject'>

export type MVideoAbuseId = Pick<VideoAbuseModel, 'id'>

export type MVideoAbuseVideo = MVideoAbuse &
  Pick<VideoAbuseModel, 'toActivityPubObject'> &
  PickWith<VideoAbuseModel, 'Video', MVideo>

export type MVideoAbuseAccountVideo = MVideoAbuseVideo &
  PickWith<VideoAbuseModel, 'Account', MAccountDefault>
