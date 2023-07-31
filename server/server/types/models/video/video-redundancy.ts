import { VideoFileModel } from '@server/models/video/video-file.js'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist.js'
import { PickWith, PickWithOpt } from '@peertube/peertube-typescript-utils'
import { VideoRedundancyModel } from '../../../models/redundancy/video-redundancy.js'
import { MVideoUrl } from './video.js'
import { MVideoFile, MVideoFileVideo } from './video-file.js'
import { MStreamingPlaylistVideo } from './video-streaming-playlist.js'

type Use<K extends keyof VideoRedundancyModel, M> = PickWith<VideoRedundancyModel, K, M>

// ############################################################################

export type MVideoRedundancy = Omit<VideoRedundancyModel, 'VideoFile' | 'VideoStreamingPlaylist' | 'Actor'>

export type MVideoRedundancyFileUrl = Pick<MVideoRedundancy, 'fileUrl'>

// ############################################################################

export type MVideoRedundancyFile =
  MVideoRedundancy &
  Use<'VideoFile', MVideoFile>

export type MVideoRedundancyFileVideo =
  MVideoRedundancy &
  Use<'VideoFile', MVideoFileVideo>

export type MVideoRedundancyStreamingPlaylistVideo =
  MVideoRedundancy &
  Use<'VideoStreamingPlaylist', MStreamingPlaylistVideo>

export type MVideoRedundancyVideo =
  MVideoRedundancy &
  Use<'VideoFile', MVideoFileVideo> &
  Use<'VideoStreamingPlaylist', MStreamingPlaylistVideo>

// ############################################################################

// Format for API or AP object

export type MVideoRedundancyAP =
  MVideoRedundancy &
  PickWithOpt<VideoRedundancyModel, 'VideoFile', MVideoFile & PickWith<VideoFileModel, 'Video', MVideoUrl>> &
  PickWithOpt<VideoRedundancyModel, 'VideoStreamingPlaylist', PickWith<VideoStreamingPlaylistModel, 'Video', MVideoUrl>>
