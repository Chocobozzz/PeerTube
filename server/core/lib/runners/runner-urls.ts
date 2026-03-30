import { WEBSERVER } from '@server/initializers/constants.js'

export function generateRunnerTranscodingInputFileUrl (options: {
  jobUUID: string
  videoUUID: string
  type: 'video' | 'audio'
}) {
  const { jobUUID, videoUUID, type } = options

  if (type === 'video') {
    return WEBSERVER.URL + '/api/v1/runners/jobs/' + jobUUID + '/files/videos/' + videoUUID + '/max-quality'
  }

  // Audio
  return WEBSERVER.URL + '/api/v1/runners/jobs/' + jobUUID + '/files/videos/' + videoUUID + '/max-quality/audio'
}

// ---------------------------------------------------------------------------

export function generateRunnerTranscodingVideoThumbnailFileUrl (jobUUID: string, videoUUID: string) {
  return WEBSERVER.URL + '/api/v1/runners/jobs/' + jobUUID + '/files/videos/' + videoUUID + '/thumbnails/max-quality'
}

export function generateRunnerEditionTranscodingVideoInputFileUrl (jobUUID: string, videoUUID: string, filename: string) {
  return WEBSERVER.URL + '/api/v1/runners/jobs/' + jobUUID + '/files/videos/' + videoUUID + '/studio/task-files/' + filename
}
