import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor } from '@app/core'
import { VideoChapter, VideoChapterUpdate } from '@peertube/peertube-models'
import { catchError } from 'rxjs/operators'
import { VideoChaptersEdit } from '../../../+videos-publish-manage/shared-manage/common/video-chapters-edit.model'
import { VideoPasswordService } from './video-password.service'
import { VideoService } from './video.service'

@Injectable()
export class VideoChapterService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)

  getChapters (options: { videoId: string, videoPassword?: string }) {
    const headers = VideoPasswordService.buildVideoPasswordHeader(options.videoPassword)

    return this.authHttp.get<{ chapters: VideoChapter[] }>(`${VideoService.BASE_VIDEO_URL}/${options.videoId}/chapters`, { headers })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  updateChapters (videoId: string, chaptersEdit: VideoChaptersEdit) {
    const body = { chapters: chaptersEdit.getChaptersForUpdate() } as VideoChapterUpdate

    return this.authHttp.put(`${VideoService.BASE_VIDEO_URL}/${videoId}/chapters`, body)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
