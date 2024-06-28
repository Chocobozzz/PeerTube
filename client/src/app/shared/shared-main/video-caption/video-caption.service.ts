import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, ServerService } from '@app/core'
import { objectToFormData } from '@app/helpers'
import { peertubeTranslate, sortBy } from '@peertube/peertube-core-utils'
import { PeerTubeProblemDocument, ResultList, ServerErrorCode, VideoCaption } from '@peertube/peertube-models'
import { Observable, from, of, throwError } from 'rxjs'
import { catchError, concatMap, map, switchMap, toArray } from 'rxjs/operators'
import { environment } from '../../../../environments/environment'
import { VideoPasswordService } from '../video/video-password.service'
import { VideoService } from '../video/video.service'
import { VideoCaptionEdit } from './video-caption-edit.model'

@Injectable()
export class VideoCaptionService {
  constructor (
    private authHttp: HttpClient,
    private serverService: ServerService,
    private restExtractor: RestExtractor
  ) {}

  listCaptions (videoId: string, videoPassword?: string): Observable<ResultList<VideoCaption>> {
    const headers = VideoPasswordService.buildVideoPasswordHeader(videoPassword)

    return this.authHttp.get<ResultList<VideoCaption>>(`${VideoService.BASE_VIDEO_URL}/${videoId}/captions`, { headers })
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
    return this.authHttp.delete(`${VideoService.BASE_VIDEO_URL}/${videoId}/captions/${language}`)
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  addCaption (videoId: number | string, language: string, captionfile: File) {
    const body = { captionfile }
    const data = objectToFormData(body)

    return this.authHttp.put(`${VideoService.BASE_VIDEO_URL}/${videoId}/captions/${language}`, data)
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  updateCaptions (videoId: number | string, videoCaptions: VideoCaptionEdit[]) {
    let obs: Observable<any> = of(undefined)

    for (const videoCaption of videoCaptions) {
      if (videoCaption.action === 'CREATE' || videoCaption.action === 'UPDATE') {
        obs = obs.pipe(switchMap(() => this.addCaption(videoId, videoCaption.language.id, videoCaption.captionfile)))
      } else if (videoCaption.action === 'REMOVE') {
        obs = obs.pipe(switchMap(() => this.removeCaption(videoId, videoCaption.language.id)))
      }
    }

    return obs
  }

  getCaptionContent ({ captionPath }: Pick<VideoCaption, 'captionPath'>) {
    return this.authHttp.get(environment.originServerUrl + captionPath, { responseType: 'text' })
  }

  generateCaption (videoIds: (number | string)[]) {
    return from(videoIds)
      .pipe(
        concatMap(videoId => {
          return this.authHttp.post(`${VideoService.BASE_VIDEO_URL}/${videoId}/captions/generate`, {})
            .pipe(
              map(() => 'success' as 'success'),
              catchError(err => {
                const error: PeerTubeProblemDocument = err.error

                if (error?.code === ServerErrorCode.VIDEO_ALREADY_HAS_CAPTIONS) {
                  return of('already-has-captions' as 'already-has-captions')
                }

                if (error?.code === ServerErrorCode.VIDEO_ALREADY_BEING_TRANSCRIBED) {
                  return of('already-being-transcribed' as 'already-being-transcribed')
                }

                return throwError(() => err)
              })
            )
        }),
        toArray(),
        map(data => {
          return data.reduce((p, c) => {
            if (c === 'success') p.success += 1
            if (c === 'already-has-captions') p.alreadyHasCaptions += 1
            if (c === 'already-being-transcribed') p.alreadyBeingTranscribed += 1

            return p
          }, { success: 0, alreadyHasCaptions: 0, alreadyBeingTranscribed: 0 })
        }),
        catchError(err => this.restExtractor.handleError(err))
      )
  }
}
