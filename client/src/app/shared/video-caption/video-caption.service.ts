import { catchError, map, switchMap } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { forkJoin, Observable, of } from 'rxjs'
import { peertubeTranslate, ResultList } from '../../../../../shared'
import { RestExtractor, RestService } from '../rest'
import { VideoService } from '@app/shared/video/video.service'
import { objectToFormData, sortBy } from '@app/shared/misc/utils'
import { VideoCaptionEdit } from '@app/shared/video-caption/video-caption-edit.model'
import { VideoCaption } from '../../../../../shared/models/videos/caption/video-caption.model'
import { ServerService } from '@app/core'

@Injectable()
export class VideoCaptionService {
  constructor (
    private authHttp: HttpClient,
    private serverService: ServerService,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {}

  listCaptions (videoId: number | string): Observable<ResultList<VideoCaption>> {
    return this.authHttp.get<ResultList<VideoCaption>>(VideoService.BASE_VIDEO_URL + videoId + '/captions')
               .pipe(
                 switchMap(captionsResult => {
                   return this.serverService.localeObservable
                     .pipe(map(translations => ({ captionsResult, translations })))
                 }),
                 map(({ captionsResult, translations }) => {
                   for (const c of captionsResult.data) {
                     c.language.label = peertubeTranslate(c.language.label, translations)
                   }

                   return captionsResult
                 }),
                 map(captionsResult => {
                   sortBy(captionsResult.data, 'language', 'label')

                   return captionsResult
                 })
               )
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
