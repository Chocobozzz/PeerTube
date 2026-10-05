import { sha256 } from '@peertube/peertube-node-utils'
import { REMOTE_DOWNLOADS, REMOTE_VIEWS } from '../../initializers/constants.js'
import { incrementInWindow, setValueIfNotExists } from './redis-client.js'

// ---------------------------------------------------------------------------
// De-duplication of views/downloads
// ---------------------------------------------------------------------------

// Returns false if another process already counted this view
export function markRemoteViewAsProcessed (viewId: string) {
  return setValueIfNotExists('remote-view-' + sha256(viewId), '1', REMOTE_VIEWS.DEDUPLICATION_LIFETIME)
}

// Returns false if another process already counted this download
export function markRemoteDownloadAsProcessed (downloadId: string) {
  return setValueIfNotExists('remote-download-' + sha256(downloadId), '1', REMOTE_DOWNLOADS.DEDUPLICATION_LIFETIME)
}

// Returns how many downloads of this video the host reported in the current rate limit window
export function incrementRemoteDownloadsOfHost (options: {
  host: string
  videoId: number
}) {
  return incrementInWindow(`remote-downloads-${options.host}-${options.videoId}`, REMOTE_DOWNLOADS.RATE_LIMIT_LIFETIME)
}
