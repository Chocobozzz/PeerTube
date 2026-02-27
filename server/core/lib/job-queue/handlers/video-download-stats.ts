import { VideoViewerStats } from "@server/lib/views/shared/video-viewer-stats.js"

export async function processVideosDownloadsStats() {
  await VideoViewerStats.save()
}
