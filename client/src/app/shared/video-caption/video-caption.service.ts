import { catchError, map } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { forkJoin, Observable, of } from 'rxjs'
import { ResultList } from '../../../../../shared'
import { RestExtractor, RestService } from '../rest'
import { VideoCaption } from '../../../../../shared/models/videos/video-caption.model'
import { VideoService } from '@app/shared/video/video.service'
import { objectToFormData, sortBy } from '@app/shared/misc/utils'
import { VideoCaptionEdit } from '@app/shared/video-caption/video-caption-edit.model'

@Injectable()
export class VideoCaptionService {
  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {}

  listCaptions (videoId: number | string): Observable<ResultList<VideoCaption>> {
    return this.authHttp.get<ResultList<VideoCaption>>(VideoService.BASE_VIDEO_URL + videoId + '/captions')
               .pipe(map(res => {
                 sortBy(res.data, 'language', 'label')

                 return res
               }))
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  removeCaption (videoId: number | string, language: string) {
    return this.authHttp.delete(VideoService.BASE_VIDEO_URL + videoId + '/captions/' + language)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  addCaption (videoId: number | string, language: string, captionfile: File) {
    const body = { captionfile }
    const data = objectToFormData(body)

    return this.authHttp.put(VideoService.BASE_VIDEO_URL + videoId + '/captions/' + language, data)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  updateCaptions (videoId: number | string, videoCaptions: VideoCaptionEdit[]) {
    const observables: Observable<any>[] = []

    for (const videoCaption of videoCaptions) {
      if (videoCaption.action === 'CREATE') {
        observables.push(
          this.addCaption(videoId, videoCaption.language.id, videoCaption.captionfile)
        )
      } else if (videoCaption.action === 'REMOVE') {
        observables.push(
          this.removeCaption(videoId, videoCaption.language.id)
        )
      }
    }

    if (observables.length === 0) return of(true)

    return forkJoin(observables)
  }
}
