import { WEBSERVER } from '@server/initializers/constants.js'

export function generateRunnerTranscodingVideoInputFileUrl (jobUUID: string, videoUUID: string) {
  return WEBSERVER.URL + '/api/v1/runners/jobs/' + jobUUID + '/files/videos/' + videoUUID + '/max-quality'
}

export function generateRunnerTranscodingAudioInputFileUrl (jobUUID: string, videoUUID: string) {
  return WEBSERVER.URL + '/api/v1/runners/jobs/' + jobUUID + '/files/videos/' + videoUUID + '/max-quality/audio'
}

export function generateRunnerTranscodingVideoPreviewFileUrl (jobUUID: string, videoUUID: string) {
  return WEBSERVER.URL + '/api/v1/runners/jobs/' + jobUUID + '/files/videos/' + videoUUID + '/previews/max-quality'
}

export function generateRunnerEditionTranscodingVideoInputFileUrl (jobUUID: string, videoUUID: string, filename: string) {
  return WEBSERVER.URL + '/api/v1/runners/jobs/' + jobUUID + '/files/videos/' + videoUUID + '/studio/task-files/' + filename
}
