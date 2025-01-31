import { PickWith, PickWithOpt } from '@peertube/peertube-typescript-utils'
import { VideoModel } from '../../../models/video/video.js'
import { MTrackerUrl } from '../server/tracker.js'
import { MUserVideoHistoryTime } from '../user/user-video-history.js'
import { MScheduleVideoUpdate } from './schedule-video-update.js'
import { MStoryboard } from './storyboard.js'
import { MTag } from './tag.js'
import { MThumbnail } from './thumbnail.js'
import { MVideoBlacklist, MVideoBlacklistLight, MVideoBlacklistUnfederated } from './video-blacklist.js'
import { MVideoCaptionLanguage, MVideoCaptionLanguageUrl } from './video-caption.js'
import {
  MChannelAccountDefault,
  MChannelAccountIdUrl,
  MChannelAccountLight,
  MChannelAccountSummaryFormattable,
  MChannelActor,
  MChannelFormattable,
  MChannelHostOnly,
  MChannelUserId
} from './video-channel.js'
import { MVideoFile } from './video-file.js'
import { MVideoLive } from './video-live.js'
import {
  MStreamingPlaylistFiles,
  MStreamingPlaylistRedundancies,
  MStreamingPlaylistRedundanciesAll,
  MStreamingPlaylistRedundanciesOpt
} from './video-streaming-playlist.js'

type Use<K extends keyof VideoModel, M> = PickWith<VideoModel, K, M>

// ############################################################################

export type MVideo =
  Omit<VideoModel, 'VideoChannel' | 'Tags' | 'Thumbnails' | 'VideoPlaylistElements' | 'VideoAbuses' |
  'VideoFiles' | 'VideoStreamingPlaylists' | 'VideoShares' | 'AccountVideoRates' | 'VideoComments' | 'VideoViews' | 'UserVideoHistories' |
  'ScheduleVideoUpdate' | 'VideoBlacklist' | 'VideoImport' | 'VideoCaptions' | 'VideoLive' | 'Trackers' | 'VideoPasswords' | 'Storyboard' |
  'AutomaticTags'>

// ############################################################################

export type MVideoId = Pick<MVideo, 'id'>
export type MVideoUrl = Pick<MVideo, 'url'>
export type MVideoUUID = Pick<MVideo, 'uuid'>

export type MVideoImmutable = Pick<MVideo, 'id' | 'url' | 'uuid' | 'remote' | 'isOwned'>
export type MVideoIdUrl = MVideoId & MVideoUrl
export type MVideoFeed = Pick<MVideo, 'name' | 'uuid'>

// ############################################################################

// Video raw associations: schedules, video files, tags, thumbnails, captions, streaming playlists, passwords

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
  MVideoWithFile &
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

export type MVideoWithBlacklistRights =
  MVideo &
  Use<'VideoBlacklist', MVideoBlacklistUnfederated>

export type MVideoAccountLight =
  MVideo &
  Use<'VideoChannel', MChannelAccountLight>

export type MVideoWithRights =
  MVideo &
  Use<'VideoBlacklist', MVideoBlacklistLight> &
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

export type MVideoAccountIdUrl =
  MVideo &
  Use<'VideoChannel', MChannelAccountIdUrl>

export type MVideoThumbnailAccountDefault =
  MVideo &
  Use<'Thumbnails', MThumbnail[]> &
  Use<'VideoChannel', MChannelAccountDefault>

export type MVideoWithChannelActor =
  MVideo &
  Use<'VideoChannel', MChannelActor>

export type MVideoWithHost =
  MVideo &
  Use<'VideoChannel', MChannelHostOnly>

export type MVideoFullLight =
  MVideo &
  Use<'Thumbnails', MThumbnail[]> &
  Use<'VideoBlacklist', MVideoBlacklistLight> &
  Use<'Tags', MTag[]> &
  Use<'VideoChannel', MChannelAccountLight> &
  Use<'UserVideoHistories', MUserVideoHistoryTime[]> &
  Use<'VideoFiles', MVideoFile[]> &
  Use<'ScheduleVideoUpdate', MScheduleVideoUpdate> &
  Use<'VideoStreamingPlaylists', MStreamingPlaylistFiles[]> &
  Use<'VideoLive', MVideoLive>

// ############################################################################

// API

export type MVideoAP =
  MVideo &
  Use<'Tags', MTag[]> &
  Use<'VideoChannel', MChannelAccountLight> &
  Use<'VideoStreamingPlaylists', MStreamingPlaylistFiles[]> &
  Use<'VideoCaptions', MVideoCaptionLanguageUrl[]> &
  Use<'VideoBlacklist', MVideoBlacklistUnfederated> &
  Use<'VideoFiles', MVideoFile[]> &
  Use<'Thumbnails', MThumbnail[]> &
  Use<'VideoLive', MVideoLive> &
  Use<'Storyboard', MStoryboard>

export type MVideoAPLight = Omit<MVideoAP, 'VideoCaptions' | 'Storyboard'>

export type MVideoDetails =
  MVideo &
  Use<'VideoBlacklist', MVideoBlacklistLight> &
  Use<'Tags', MTag[]> &
  Use<'VideoChannel', MChannelAccountLight> &
  Use<'ScheduleVideoUpdate', MScheduleVideoUpdate> &
  Use<'Thumbnails', MThumbnail[]> &
  Use<'UserVideoHistories', MUserVideoHistoryTime[]> &
  Use<'VideoStreamingPlaylists', MStreamingPlaylistRedundancies[]> &
  Use<'VideoFiles', MVideoFile[]> &
  Use<'Trackers', MTrackerUrl[]>

export type MVideoForUser =
  MVideo &
  Use<'VideoChannel', MChannelAccountDefault> &
  Use<'ScheduleVideoUpdate', MScheduleVideoUpdate> &
  Use<'VideoBlacklist', MVideoBlacklistLight> &
  Use<'Thumbnails', MThumbnail[]>

export type MVideoForRedundancyAPI =
  MVideo &
  Use<'VideoStreamingPlaylists', MStreamingPlaylistRedundanciesAll[]>

// ############################################################################

// Format for API or AP object

export type MVideoFormattable =
  MVideoThumbnail &
  PickWithOpt<VideoModel, 'UserVideoHistories', MUserVideoHistoryTime[]> &
  Use<'VideoChannel', MChannelAccountSummaryFormattable> &
  PickWithOpt<VideoModel, 'ScheduleVideoUpdate', Pick<MScheduleVideoUpdate, 'updateAt' | 'privacy'>> &
  PickWithOpt<VideoModel, 'VideoBlacklist', Pick<MVideoBlacklist, 'reason'>> &
  PickWithOpt<VideoModel, 'VideoStreamingPlaylists', MStreamingPlaylistFiles[]> &
  PickWithOpt<VideoModel, 'VideoFiles', MVideoFile[]>

export type MVideoFormattableDetails =
  MVideoFormattable &
  Use<'VideoChannel', MChannelFormattable> &
  Use<'Tags', MTag[]> &
  Use<'VideoStreamingPlaylists', MStreamingPlaylistRedundanciesOpt[]> &
  Use<'VideoFiles', MVideoFile[]> &
  PickWithOpt<VideoModel, 'Trackers', MTrackerUrl[]>
