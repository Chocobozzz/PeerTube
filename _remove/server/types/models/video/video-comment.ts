import { PickWith, PickWithOpt } from '@shared/typescript-utils'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { MAccountDefault, MAccountFormattable, MAccountUrl } from '../account'
import { MVideo, MVideoAccountLight, MVideoFeed, MVideoIdUrl, MVideoUrl } from './video'

type Use<K extends keyof VideoCommentModel, M> = PickWith<VideoCommentModel, K, M>

// ############################################################################

export type MComment = Omit<VideoCommentModel, 'OriginVideoComment' | 'InReplyToVideoComment' | 'Video' | 'Account'>
export type MCommentTotalReplies = MComment & { totalReplies?: number }
export type MCommentId = Pick<MComment, 'id'>
export type MCommentUrl = Pick<MComment, 'url'>

// ############################################################################

export type MCommentOwner =
  MComment &
  Use<'Account', MAccountDefault>

export type MCommentVideo =
  MComment &
  Use<'Video', MVideoAccountLight>

export type MCommentReply =
  MComment &
  Use<'InReplyToVideoComment', MComment>

export type MCommentOwnerVideo =
  MComment &
  Use<'Account', MAccountDefault> &
  Use<'Video', MVideoAccountLight>

export type MCommentOwnerVideoReply =
  MComment &
  Use<'Account', MAccountDefault> &
  Use<'Video', MVideoAccountLight> &
  Use<'InReplyToVideoComment', MComment>

export type MCommentOwnerReplyVideoLight =
  MComment &
  Use<'Account', MAccountDefault> &
  Use<'InReplyToVideoComment', MComment> &
  Use<'Video', MVideoIdUrl>

export type MCommentOwnerVideoFeed =
  MCommentOwner &
  Use<'Video', MVideoFeed>

// ############################################################################

export type MCommentAPI = MComment & { totalReplies: number }

// ############################################################################

// Format for API or AP object

export type MCommentFormattable =
  MCommentTotalReplies &
  Use<'Account', MAccountFormattable>

export type MCommentAdminFormattable =
  MComment &
  Use<'Account', MAccountFormattable> &
  Use<'Video', MVideo>

export type MCommentAP =
  MComment &
  Use<'Account', MAccountUrl> &
  PickWithOpt<VideoCommentModel, 'Video', MVideoUrl> &
  PickWithOpt<VideoCommentModel, 'InReplyToVideoComment', MCommentUrl>
