import { LocalVideoViewerModel } from '@server/models/view/local-video-viewer.js'
import { PickWith } from '@peertube/peertube-typescript-utils'
import { MLocalVideoViewerWatchSection } from './local-video-viewer-watch-section.js'
import { MVideo } from './video.js'

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
