import { VideoModel } from '../../../models/video/video'
import { PickWith, PickWithOpt } from '@shared/core-utils'
import {
  MChannelAccountDefault,
  MChannelAccountLight,
  MChannelAccountSummaryFormattable,
  MChannelActor,
  MChannelFormattable,
  MChannelUserId
} from './video-channels'
import { MTag } from './tag'
import { MVideoCaptionLanguage, MVideoCaptionLanguageUrl } from './video-caption'
import {
  MStreamingPlaylistFiles,
  MStreamingPlaylistRedundancies,
  MStreamingPlaylistRedundanciesAll,
  MStreamingPlaylistRedundanciesOpt
} from './video-streaming-playlist'
import { MVideoFile, MVideoFileRedundanciesAll, MVideoFileRedundanciesOpt } from './video-file'
import { MThumbnail } from './thumbnail'
import { MVideoBlacklist, MVideoBlacklistLight, MVideoBlacklistUnfederated } from './video-blacklist'
import { MScheduleVideoUpdate } from './schedule-video-update'
import { MUserVideoHistoryTime } from '../user/user-video-history'

type Use<K extends keyof VideoModel, M> = PickWith<VideoModel, K, M>

// ############################################################################

export type MVideo =
  Omit<VideoModel, 'VideoChannel' | 'Tags' | 'Thumbnails' | 'VideoPlaylistElements' | 'VideoAbuses' |
  'VideoFiles' | 'VideoStreamingPlaylists' | 'VideoShares' | 'AccountVideoRates' | 'VideoComments' | 'VideoViews' | 'UserVideoHistories' |
  'ScheduleVideoUpdate' | 'VideoBlacklist' | 'VideoImport' | 'VideoCaptions'>

// ############################################################################

export type MVideoId = Pick<MVideo, 'id'>
export type MVideoUrl = Pick<MVideo, 'url'>
export type MVideoUUID = Pick<MVideo, 'uuid'>

export type MVideoImmutable = Pick<MVideo, 'id' | 'url' | 'uuid' | 'remote' | 'isOwned'>
export type MVideoIdUrl = MVideoId & MVideoUrl
export type MVideoFeed = Pick<MVideo, 'name' | 'uuid'>

// ############################################################################

// Video raw associations: schedules, video files, tags, thumbnails, captions, streaming playlists

// "With" to not confuse with the VideoFile model
export type MVideoWithFile =
  MVideo &
  Use<'VideoFiles', MVideoFile[]> &
  Use<'VideoStreamingPlaylists', MStreamingPlaylistFiles[]>

export type MVideoThumbnail =
  MVideo &
  Use<'Thumbnails', MThumbnail[]>

export type MVideoIdThumbnail =
  MVideoId &
  Use<'Thumbnails', MThumbnail[]>

export type MVideoWithFileThumbnail =
  MVideo &
  Use<'VideoFiles', MVideoFile[]> &
  Use<'Thumbnails', MThumbnail[]>

export type MVideoThumbnailBlacklist =
  MVideo &
  Use<'Thumbnails', MThumbnail[]> &
  Use<'VideoBlacklist', MVideoBlacklistLight>

export type MVideoTag =
  MVideo &
  Use<'Tags', MTag[]>

export type MVideoWithSchedule =
  MVideo &
  PickWithOpt<VideoModel, 'ScheduleVideoUpdate', MScheduleVideoUpdate>

export type MVideoWithCaptions =
  MVideo &
  Use<'VideoCaptions', MVideoCaptionLanguage[]>

export type MVideoWithStreamingPlaylist =
  MVideo &
  Use<'VideoStreamingPlaylists', MStreamingPlaylistFiles[]>

// ############################################################################

// Associations with not all their attributes

export type MVideoUserHistory =
  MVideo &
  Use<'UserVideoHistories', MUserVideoHistoryTime[]>

export type MVideoWithBlacklistLight =
  MVideo &
  Use<'VideoBlacklist', MVideoBlacklistLight>

export type MVideoAccountLight =
  MVideo &
  Use<'VideoChannel', MChannelAccountLight>

export type MVideoWithRights =
  MVideo &
  Use<'VideoBlacklist', MVideoBlacklistLight> &
  Use<'Thumbnails', MThumbnail[]> &
  Use<'VideoChannel', MChannelUserId>

// ############################################################################

// All files with some additional associations

export type MVideoWithAllFiles =
  MVideo &
  Use<'VideoFiles', MVideoFile[]> &
  Use<'Thumbnails', MThumbnail[]> &
  Use<'VideoStreamingPlaylists', MStreamingPlaylistFiles[]>

export type MVideoAccountLightBlacklistAllFiles =
  MVideo &
  Use<'VideoFiles', MVideoFile[]> &
  Use<'Thumbnails', MThumbnail[]> &
  Use<'VideoStreamingPlaylists', MStreamingPlaylistFiles[]> &
  Use<'VideoChannel', MChannelAccountLight> &
  Use<'VideoBlacklist', MVideoBlacklistLight>

// ############################################################################

// With account

export type MVideoAccountDefault =
  MVideo &
  Use<'VideoChannel', MChannelAccountDefault>

export type MVideoThumbnailAccountDefault =
  MVideo &
  Use<'Thumbnails', MThumbnail[]> &
  Use<'VideoChannel', MChannelAccountDefault>

export type MVideoWithChannelActor =
  MVideo &
  Use<'VideoChannel', MChannelActor>

export type MVideoFullLight =
  MVideo &
  Use<'Thumbnails', MThumbnail[]> &
  Use<'VideoBlacklist', MVideoBlacklistLight> &
  Use<'Tags', MTag[]> &
  Use<'VideoChannel', MChannelAccountLight> &
  Use<'UserVideoHistories', MUserVideoHistoryTime[]> &
  Use<'VideoFiles', MVideoFile[]> &
  Use<'ScheduleVideoUpdate', MScheduleVideoUpdate> &
  Use<'VideoStreamingPlaylists', MStreamingPlaylistFiles[]>

// ############################################################################

// API

export type MVideoAP =
  MVideo &
  Use<'Tags', MTag[]> &
  Use<'VideoChannel', MChannelAccountLight> &
  Use<'VideoStreamingPlaylists', MStreamingPlaylistFiles[]> &
  Use<'VideoCaptions', MVideoCaptionLanguageUrl[]> &
  Use<'VideoBlacklist', MVideoBlacklistUnfederated> &
  Use<'VideoFiles', MVideoFileRedundanciesOpt[]> &
  Use<'Thumbnails', MThumbnail[]>

export type MVideoAPWithoutCaption = Omit<MVideoAP, 'VideoCaptions'>

export type MVideoDetails =
  MVideo &
  Use<'VideoBlacklist', MVideoBlacklistLight> &
  Use<'Tags', MTag[]> &
  Use<'VideoChannel', MChannelAccountLight> &
  Use<'ScheduleVideoUpdate', MScheduleVideoUpdate> &
  Use<'Thumbnails', MThumbnail[]> &
  Use<'UserVideoHistories', MUserVideoHistoryTime[]> &
  Use<'VideoStreamingPlaylists', MStreamingPlaylistRedundancies[]> &
  Use<'VideoFiles', MVideoFileRedundanciesOpt[]>

export type MVideoForUser =
  MVideo &
  Use<'VideoChannel', MChannelAccountDefault> &
  Use<'ScheduleVideoUpdate', MScheduleVideoUpdate> &
  Use<'VideoBlacklist', MVideoBlacklistLight> &
  Use<'Thumbnails', MThumbnail[]>

export type MVideoForRedundancyAPI =
  MVideo &
  Use<'VideoFiles', MVideoFileRedundanciesAll[]> &
  Use<'VideoStreamingPlaylists', MStreamingPlaylistRedundanciesAll[]>

// ############################################################################

// Format for API or AP object

export type MVideoFormattable =
  MVideo &
  PickWithOpt<VideoModel, 'UserVideoHistories', MUserVideoHistoryTime[]> &
  Use<'VideoChannel', MChannelAccountSummaryFormattable> &
  PickWithOpt<VideoModel, 'ScheduleVideoUpdate', Pick<MScheduleVideoUpdate, 'updateAt' | 'privacy'>> &
  PickWithOpt<VideoModel, 'VideoBlacklist', Pick<MVideoBlacklist, 'reason'>>

export type MVideoFormattableDetails =
  MVideoFormattable &
  Use<'VideoChannel', MChannelFormattable> &
  Use<'Tags', MTag[]> &
  Use<'VideoStreamingPlaylists', MStreamingPlaylistRedundanciesOpt[]> &
  Use<'VideoFiles', MVideoFileRedundanciesOpt[]>
