import { VideoRedundancyModel } from '../../../models/redundancy/video-redundancy'
import { PickWith } from '@server/typings/utils'
import { MStreamingPlaylistVideo, MVideoFile, MVideoFileVideo } from '@server/typings/models'

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
