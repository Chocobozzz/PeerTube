import { VideoDuplicatePayload } from '@peertube/peertube-models'
import { duplicateVideoFiles } from '@server/lib/video-duplicate/index.js'
import { Job } from 'bullmq'

export function processVideoDuplicate (job: Job<VideoDuplicatePayload>) {
  return duplicateVideoFiles(job.data)
}
