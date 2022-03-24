import { LocalVideoViewerModel } from '@server/models/view/local-video-viewer'
import { PickWith } from '@shared/typescript-utils'
import { MLocalVideoViewerWatchSection } from './local-video-viewer-watch-section'
import { MVideo } from './video'

type Use<K extends keyof LocalVideoViewerModel, M> = PickWith<LocalVideoViewerModel, K, M>

// ############################################################################

export type MLocalVideoViewer = Omit<LocalVideoViewerModel, 'Video'>

export type MLocalVideoViewerVideo =
  MLocalVideoViewer &
  Use<'Video', MVideo>

export type MLocalVideoViewerWithWatchSections =
  MLocalVideoViewer &
  Use<'Video', MVideo> &
  Use<'WatchSections', MLocalVideoViewerWatchSection[]>
