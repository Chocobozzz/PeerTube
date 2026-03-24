import { LocalVideoViewerWatchSectionModel } from '@server/models/stat/local-video-viewer-watch-section.js'

// ############################################################################

export type MLocalVideoViewerWatchSection = Omit<LocalVideoViewerWatchSectionModel, 'LocalVideoViewerModel'>
