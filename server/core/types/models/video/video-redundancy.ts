import { PickWith, PickWithOpt } from '@peertube/peertube-typescript-utils'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist.js'
import { VideoRedundancyModel } from '../../../models/redundancy/video-redundancy.js'
import { MStreamingPlaylistVideo } from './video-streaming-playlist.js'
import { MVideoUrl } from './video.js'

type Use<K extends keyof VideoRedundancyModel, M> = PickWith<VideoRedundancyModel, K, M>

// ############################################################################

export type MVideoRedundancy = Omit<VideoRedundancyModel, 'VideoStreamingPlaylist' | 'Actor'>

export type MVideoRedundancyFileUrl = Pick<MVideoRedundancy, 'fileUrl'>

// ############################################################################

export type MVideoRedundancyStreamingPlaylistVideo =
  MVideoRedundancy &
  Use<'VideoStreamingPlaylist', MStreamingPlaylistVideo>

export type MVideoRedundancyVideo =
  MVideoRedundancy &
  Use<'VideoStreamingPlaylist', MStreamingPlaylistVideo>

// ############################################################################

// Format for API or AP object

export type MVideoRedundancyAP =
  MVideoRedundancy &
  PickWithOpt<VideoRedundancyModel, 'VideoStreamingPlaylist', PickWith<VideoStreamingPlaylistModel, 'Video', MVideoUrl>>
