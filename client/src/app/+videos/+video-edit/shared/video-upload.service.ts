import { UploaderX, UploadState, UploadxOptions } from 'ngx-uploadx'
import { HttpErrorResponse, HttpEventType, HttpHeaders } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AuthService, Notifier, ServerService } from '@app/core'
import { BytesPipe, VideoService } from '@app/shared/shared-main'
import { HttpStatusCode } from '@shared/models'
import { UploaderXFormData } from './uploaderx-form-data'

@Injectable()
export class VideoUploadService {

  constructor (
    private server: ServerService,
    private notifier: Notifier,
    private authService: AuthService
  ) {

  }

  getVideoExtensions () {
    return this.server.getHTMLConfig().video.file.extensions
  }

  checkQuotaAndNotify (videoFile: File, maxQuota: number, quotaUsed: number) {
    const bytePipes = new BytesPipe()

    // Check global user quota
    if (maxQuota !== -1 && (quotaUsed + videoFile.size) > maxQuota) {
      const videoSizeBytes = bytePipes.transform(videoFile.size, 0)
      const videoQuotaUsedBytes = bytePipes.transform(quotaUsed, 0)
      const videoQuotaBytes = bytePipes.transform(maxQuota, 0)

      // eslint-disable-next-line max-len
      const msg = $localize`Your video quota is exceeded with this video (video size: ${videoSizeBytes}, used: ${videoQuotaUsedBytes}, quota: ${videoQuotaBytes})`
      this.notifier.error(msg)

      return false
    }

    return true
  }

  isAudioFile (filename: string) {
    const extensions = [ '.mp3', '.flac', '.ogg', '.wma', '.wav' ]

    return extensions.some(e => filename.endsWith(e))
  }

  // ---------------------------------------------------------------------------

  getNewUploadxOptions (): UploadxOptions {
    return this.getUploadxOptions(
      VideoService.BASE_VIDEO_URL + '/upload-resumable',
      UploaderXFormData
    )
  }

  getReplaceUploadxOptions (videoId: string): UploadxOptions {
    return this.getUploadxOptions(
      VideoService.BASE_VIDEO_URL + '/' + videoId + '/source/replace-resumable',
      UploaderX
    )
  }

  private getUploadxOptions (endpoint: string, uploaderClass: typeof UploaderXFormData) {
    return {
      endpoint,
      multiple: false,

      maxChunkSize: this.server.getHTMLConfig().client.videos.resumableUpload.maxChunkSize,

      token: this.authService.getAccessToken(),

      uploaderClass,

      retryConfig: {
        maxAttempts: 30, // maximum attempts for 503 codes, otherwise set to 6, see below
        maxDelay: 120_000, // 2 min
        shouldRetry: (code: number, attempts: number) => {
          return code === HttpStatusCode.SERVICE_UNAVAILABLE_503 || ((code < 400 || code > 500) && attempts < 6)
        }
      }
    }
  }

  // ---------------------------------------------------------------------------

  buildHTTPErrorResponse (state: UploadState): HttpErrorResponse {
    const error = state.response?.error?.message || state.response?.error || 'Unknown error'

    return {
      error: new Error(error),
      name: 'HttpErrorResponse',
      message: error,
      ok: false,
      headers: new HttpHeaders(state.responseHeaders),
      status: +state.responseStatus,
      statusText: error,
      type: HttpEventType.Response,
      url: state.url
    }
  }
}
