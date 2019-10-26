import { VideoRedundancyModel } from '../../../models/redundancy/video-redundancy'
import { PickWith, PickWithOpt } from '@server/typings/utils'
import { MStreamingPlaylistVideo, MVideoFile, MVideoFileVideo, MVideoUrl } from '@server/typings/models'
import { VideoStreamingPlaylist } from '../../../../shared/models/videos/video-streaming-playlist.model'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist'
import { VideoFile } from '../../../../shared/models/videos'
import { VideoFileModel } from '@server/models/video/video-file'

type Use<K extends keyof VideoRedundancyModel, M> = PickWith<VideoRedundancyModel, K, M>

// ############################################################################

export type MVideoRedundancy = Omit<VideoRedundancyModel, 'VideoFile' | 'VideoStreamingPlaylist' | 'Actor'>

export type MVideoRedundancyFileUrl = Pick<MVideoRedundancy, 'fileUrl'>

// ############################################################################

export type MVideoRedundancyFile = MVideoRedundancy &
  Use<'VideoFile', MVideoFile>

export type MVideoRedundancyFileVideo = MVideoRedundancy &
  Use<'VideoFile', MVideoFileVideo>

export type MVideoRedundancyStreamingPlaylistVideo = MVideoRedundancy &
  Use<'VideoStreamingPlaylist', MStreamingPlaylistVideo>

export type MVideoRedundancyVideo = MVideoRedundancy &
  Use<'VideoFile', MVideoFileVideo> &
  Use<'VideoStreamingPlaylist', MStreamingPlaylistVideo>

// ############################################################################

// Format for API or AP object

export type MVideoRedundancyAP = MVideoRedundancy &
  PickWithOpt<VideoRedundancyModel, 'VideoFile', MVideoFile & PickWith<VideoFileModel, 'Video', MVideoUrl>> &
  PickWithOpt<VideoRedundancyModel, 'VideoStreamingPlaylist', PickWith<VideoStreamingPlaylistModel, 'Video', MVideoUrl>>
