import { LocalVideoViewerWatchSectionModel } from '@server/models/view/local-video-viewer-watch-section'

// ############################################################################

export type MLocalVideoViewerWatchSection = Omit<LocalVideoViewerWatchSectionModel, 'LocalVideoViewerModel'>
