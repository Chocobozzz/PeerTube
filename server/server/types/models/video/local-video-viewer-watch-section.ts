import { LocalVideoViewerWatchSectionModel } from '@server/models/view/local-video-viewer-watch-section.js'

// ############################################################################

export type MLocalVideoViewerWatchSection = Omit<LocalVideoViewerWatchSectionModel, 'LocalVideoViewerModel'>
