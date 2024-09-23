import { UploaderX, UploadxOptions } from 'ngx-uploadx'
import { Injectable } from '@angular/core'
import { AuthService, Notifier, ServerService } from '@app/core'
import { UploaderXFormData } from './uploaderx-form-data'
import { getUploadXRetryConfig } from '@app/helpers'
import { BytesPipe } from '@app/shared/shared-main/common/bytes.pipe'
import { VideoService } from '@app/shared/shared-main/video/video.service'

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

      retryConfig: getUploadXRetryConfig()
    }
  }
}
