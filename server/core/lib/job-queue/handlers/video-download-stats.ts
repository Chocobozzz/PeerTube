import { VideoDownloadStats } from "@server/lib/stats/video-download.js";

export async function processVideosDownloadsStats() {
  await VideoDownloadStats.save();
}
