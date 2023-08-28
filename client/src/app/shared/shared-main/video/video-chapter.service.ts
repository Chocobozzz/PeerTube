import { catchError } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor } from '@app/core'
import { VideoChapter, VideoChapterUpdate } from '@peertube/peertube-models'
import { VideoPasswordService } from './video-password.service'
import { VideoService } from './video.service'
import { VideoChaptersEdit } from './video-chapters-edit.model'
import { of } from 'rxjs'

@Injectable()
export class VideoChapterService {

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor
  ) {}

  getChapters (options: { videoId: string, videoPassword?: string }) {
    const headers = VideoPasswordService.buildVideoPasswordHeader(options.videoPassword)

    return this.authHttp.get<{ chapters: VideoChapter[] }>(`${VideoService.BASE_VIDEO_URL}/${options.videoId}/chapters`, { headers })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  updateChapters (videoId: string, chaptersEdit: VideoChaptersEdit) {
    if (chaptersEdit.shouldUpdateAPI() !== true) return of(true)

    const body = { chapters: chaptersEdit.getChaptersForUpdate() } as VideoChapterUpdate

    return this.authHttp.put(`${VideoService.BASE_VIDEO_URL}/${videoId}/chapters`, body)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
