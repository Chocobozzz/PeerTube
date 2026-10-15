import { VideoDuplicatePayload } from '@peertube/peertube-models'
import { duplicateVideoForStudio } from '@server/lib/video-duplicate.js'
import { Job } from 'bullmq'

export function processVideoDuplicate (job: Job<VideoDuplicatePayload>) {
  return duplicateVideoForStudio(job.data)
}