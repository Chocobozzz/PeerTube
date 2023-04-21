import { WEBSERVER } from '@server/initializers/constants'

export function generateRunnerTranscodingVideoInputFileUrl (jobUUID: string, videoUUID: string) {
  return WEBSERVER.URL + '/api/v1/runners/jobs/' + jobUUID + '/files/videos/' + videoUUID + '/max-quality'
}

export function generateRunnerTranscodingVideoPreviewFileUrl (jobUUID: string, videoUUID: string) {
  return WEBSERVER.URL + '/api/v1/runners/jobs/' + jobUUID + '/files/videos/' + videoUUID + '/previews/max-quality'
}
