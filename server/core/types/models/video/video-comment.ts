import { PickWith, PickWithOpt } from '@peertube/peertube-typescript-utils'
import { VideoCommentModel } from '../../../models/video/video-comment.js'
import { MAccountDefault, MAccountFormattable, MAccountUrl } from '../account/index.js'
import { MCommentAutomaticTagWithTag } from '../automatic-tag/comment-automatic-tag.js'
import { MVideo, MVideoAccountIdUrl, MVideoAccountLight, MVideoFeed, MVideoIdUrl, MVideoImmutable, MVideoUUID } from './video.js'

type Use<K extends keyof VideoCommentModel, M> = PickWith<VideoCommentModel, K, M>

// ############################################################################

export type MComment =
  Omit<VideoCommentModel, 'OriginVideoComment' | 'InReplyToVideoComment' | 'Video' | 'Account' | 'CommentAutomaticTags'>

export type MCommentTotalReplies = MComment & { totalReplies?: number }
export type MCommentId = Pick<MComment, 'id'>
export type MCommentUrl = Pick<MComment, 'url'>

// ---------------------------------------------------------------------------

export type MCommentExport =
  Pick<MComment, 'id' | 'url' | 'text' | 'createdAt'> &
  Use<'Video', MVideoIdUrl & MVideoUUID> &
  Use<'InReplyToVideoComment', MCommentUrl>

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
  Use<'Video', MVideoAccountIdUrl>

export type MCommentOwnerVideoReply =
  MComment &
  Use<'Account', MAccountDefault> &
  Use<'Video', MVideoAccountIdUrl> &
  Use<'InReplyToVideoComment', MComment>

export type MCommentOwnerReplyVideoImmutable =
  MComment &
  Use<'Account', MAccountDefault> &
  Use<'InReplyToVideoComment', MComment> &
  Use<'Video', MVideoImmutable>

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

export type MCommentAdminOrUserFormattable =
  MComment &
  Use<'Account', MAccountFormattable> &
  Use<'Video', MVideo> &
  Use<'CommentAutomaticTags', MCommentAutomaticTagWithTag[]>

export type MCommentAP =
  MComment &
  Use<'Account', MAccountUrl> &
  PickWithOpt<VideoCommentModel, 'Video', MVideoImmutable> &
  PickWithOpt<VideoCommentModel, 'InReplyToVideoComment', MCommentUrl>
