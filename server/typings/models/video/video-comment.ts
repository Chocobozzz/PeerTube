import { VideoCommentModel } from '../../../models/video/video-comment'
import { PickWith } from '../../utils'
import { MAccountDefault } from '../account'
import { MVideoAccountDefault, MVideoAccountLight, MVideoFeed, MVideoIdUrl } from './video'

export type MComment = Omit<VideoCommentModel, 'OriginVideoComment' | 'InReplyToVideoComment' | 'Video' | 'Account'>
export type MCommentId = Pick<MComment, 'id'>

export type MCommentAPI = MComment & { totalReplies: number }

export type MCommentOwner = MComment &
  PickWith<VideoCommentModel, 'Account', MAccountDefault>

export type MCommentVideo = MComment &
  PickWith<VideoCommentModel, 'Video', MVideoAccountLight>

export type MCommentReply = MComment &
  PickWith<VideoCommentModel, 'InReplyToVideoComment', MComment>

export type MCommentOwnerReply = MCommentOwner & MCommentReply
export type MCommentOwnerVideo = MCommentOwner & MCommentVideo
export type MCommentReplyVideo = MCommentReply & MCommentVideo
export type MCommentOwnerVideoReply = MCommentOwnerVideo & MCommentReply

export type MCommentOwnerReplyVideoLight = MCommentOwnerReply &
  PickWith<VideoCommentModel, 'Video', MVideoIdUrl>

export type MCommentOwnerVideoFeed = MCommentOwner &
  PickWith<VideoCommentModel, 'Video', MVideoFeed>
