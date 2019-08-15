import { VideoModel } from '../../../models/video/video'
import { PickWith, PickWithOpt } from '../../utils'
import { MChannelAccountLight, MChannelActor, MChannelActorAccountDefault, MChannelUserId } from './video-channels'
import { MTag } from './tag'
import { MVideoCaptionLanguage } from './video-caption'
import { MStreamingPlaylist, MStreamingPlaylistRedundancies } from './video-streaming-playlist'
import { MVideoFile, MVideoFileRedundanciesOpt } from './video-file'
import { MThumbnail } from './thumbnail'
import { MVideoBlacklistLight, MVideoBlacklistUnfederated } from './video-blacklist'
import { MScheduleVideoUpdate } from './schedule-video-update'
import { MUserVideoHistoryTime } from '../user/user-video-history'

export type MVideo = Omit<VideoModel, 'VideoChannel' | 'Tags' | 'Thumbnails' | 'VideoPlaylistElements' | 'VideoAbuses' |
  'VideoFiles' | 'VideoStreamingPlaylists' | 'VideoShares' | 'AccountVideoRates' | 'VideoComments' | 'VideoViews' | 'UserVideoHistories' |
  'ScheduleVideoUpdate' | 'VideoBlacklist' | 'VideoImport' | 'VideoCaptions'>

export type MVideoId = Pick<MVideo, 'id'>
export type MVideoUrl = Pick<MVideo, 'url'>
export type MVideoUUID = Pick<MVideo, 'uuid'>

export type MVideoIdUrl = MVideoId & MVideoUrl
export type MVideoFeed = Pick<MVideo, 'name' | 'uuid'>

export type MVideoWithFile = MVideo &
  PickWith<VideoModel, 'VideoFiles', MVideoFile[]>

export type MVideoThumbnail = MVideo &
  PickWith<VideoModel, 'Thumbnails', MThumbnail[]>
export type MVideoIdThumbnail = MVideoThumbnail & MVideoId

export type MVideoTag = MVideo &
  PickWith<VideoModel, 'Tags', MTag[]>

export type MVideoWithSchedule = MVideo &
  PickWithOpt<VideoModel, 'ScheduleVideoUpdate', MScheduleVideoUpdate>

export type MVideoWithFileThumbnail = MVideoWithFile & MVideoThumbnail

export type MVideoUser = MVideo &
  PickWith<VideoModel, 'VideoChannel', MChannelUserId>

export type MVideoWithCaptions = MVideo &
  PickWith<VideoModel, 'VideoCaptions', MVideoCaptionLanguage[]>

export type MVideoWithBlacklistLight = MVideo &
  PickWith<VideoModel, 'VideoBlacklist', MVideoBlacklistLight>

export type MVideoAccountLight = MVideo &
  PickWith<VideoModel, 'VideoChannel', MChannelAccountLight>

export type MVideoWithRights = MVideoWithBlacklistLight & MVideoThumbnail & MVideoUser

export type MVideoWithStreamingPlaylist = MVideo &
  PickWith<VideoModel, 'VideoStreamingPlaylists', MStreamingPlaylist[]>

export type MVideoWithAllFiles = MVideoWithFileThumbnail & MVideoWithStreamingPlaylist

export type MVideoAccountAllFiles = MVideoWithAllFiles & MVideoAccountLight & MVideoWithBlacklistLight
export type MVideoAccountAllFilesCaptions = MVideoAccountAllFiles & MVideoWithCaptions

export type MVideoUserHistory = MVideo &
  PickWith<VideoModel, 'UserVideoHistories', MUserVideoHistoryTime[]>

export type MVideoWithBlacklistThumbnailScheduled = MVideoWithSchedule & MVideoWithBlacklistLight & MVideoWithFileThumbnail

export type MVideoAccountDefault = MVideo &
  PickWith<VideoModel, 'VideoChannel', MChannelActorAccountDefault>

export type MVideoThumbnailAccountDefault = MVideoThumbnail &
  PickWith<VideoModel, 'VideoChannel', MChannelActorAccountDefault>

export type MVideoWithChannelActor = MVideo &
  PickWith<VideoModel, 'VideoChannel', MChannelActor>

export type MVideoFullLight = MVideoThumbnail &
  MVideoWithBlacklistLight &
  MVideoTag &
  MVideoAccountLight &
  MVideoUserHistory &
  MVideoWithFile &
  MVideoWithSchedule &
  MVideoWithStreamingPlaylist &
  MVideoUserHistory

export type MVideoAP = MVideo &
  MVideoTag &
  MVideoAccountLight &
  MVideoWithStreamingPlaylist &
  MVideoWithCaptions &
  PickWith<VideoModel, 'VideoBlacklist', MVideoBlacklistUnfederated> &
  PickWith<VideoModel, 'VideoFiles', MVideoFileRedundanciesOpt[]>

export type MVideoAPWithoutCaption = Omit<MVideoAP, 'VideoCaptions'>

export type MVideoDetails = MVideo &
  MVideoWithBlacklistLight &
  MVideoTag &
  MVideoAccountLight &
  MVideoWithSchedule &
  MVideoThumbnail &
  MVideoUserHistory &
  PickWith<VideoModel, 'VideoStreamingPlaylists', MStreamingPlaylistRedundancies[]> &
  PickWith<VideoModel, 'VideoFiles', MVideoFileRedundanciesOpt[]>
