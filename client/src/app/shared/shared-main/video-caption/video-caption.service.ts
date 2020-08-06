import { Observable, of } from 'rxjs'
import { catchError, map, switchMap } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, ServerService } from '@app/core'
import { objectToFormData, sortBy } from '@app/helpers'
import { VideoService } from '@app/shared/shared-main/video'
import { peertubeTranslate } from '@shared/core-utils/i18n'
import { ResultList, VideoCaption } from '@shared/models'
import { VideoCaptionEdit } from './video-caption-edit.model'

@Injectable()
export class VideoCaptionService {
  constructor (
    private authHttp: HttpClient,
    private serverService: ServerService,
    private restExtractor: RestExtractor
  ) {}

  listCaptions (videoId: number | string): Observable<ResultList<VideoCaption>> {
    return this.authHttp.get<ResultList<VideoCaption>>(VideoService.BASE_VIDEO_URL + videoId + '/captions')
               .pipe(
                 switchMap(captionsResult => {
                   return this.serverService.getServerLocale()
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
    let obs = of(true)

    for (const videoCaption of videoCaptions) {
      if (videoCaption.action === 'CREATE') {
        obs = obs.pipe(switchMap(() => this.addCaption(videoId, videoCaption.language.id, videoCaption.captionfile)))
      } else if (videoCaption.action === 'REMOVE') {
        obs = obs.pipe(switchMap(() => this.removeCaption(videoId, videoCaption.language.id)))
      }
    }

    return obs
  }
}
