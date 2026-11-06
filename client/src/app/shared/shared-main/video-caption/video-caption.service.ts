import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { ConfirmService, RestExtractor, ServerService } from '@app/core'
import { formatICU, objectToFormData } from '@app/helpers'
import { peertubeTranslate, sortBy } from '@peertube/peertube-core-utils'
import { PeerTubeProblemDocument, ResultList, ServerErrorCode, Video, VideoCaption, VideoCaptionGenerate } from '@peertube/peertube-models'
import { Observable, of } from 'rxjs'
import { catchError, map, switchMap } from 'rxjs/operators'
import { VideoCaptionEdit } from '../../../+videos-publish-manage/shared-manage/common/video-caption-edit.model'
import {
  confirmVideosForce,
  countVideoForceRunOutcomes,
  getVideoForceRunFailures,
  runOnVideosWithForceConfirm
} from '../video/video-force-run'
import { VideoPasswordService } from '../video/video-password.service'
import { VideoService } from '../video/video.service'

@Injectable()
export class VideoCaptionService {
  private authHttp = inject(HttpClient)
  private serverService = inject(ServerService)
  private restExtractor = inject(RestExtractor)
  private confirmService = inject(ConfirmService)

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

  getCaptionContent ({ fileUrl }: Pick<VideoCaption, 'fileUrl'>) {
    return this.authHttp.get(fileUrl, { responseType: 'text' })
  }

  // ---------------------------------------------------------------------------

  generateCaption (options: {
    videos: Video[]
  }): Observable<{
    success: number
    alreadyHasCaptions: number
    alreadyBeingTranscribed: number
    failures: { video: Video, error: Error }[]
  }> {
    const { videos } = options

    return runOnVideosWithForceConfirm({
      videos,

      run: (video, forceTranscription) => {
        const body: VideoCaptionGenerate = { forceTranscription }

        return this.authHttp.post(`${VideoService.BASE_VIDEO_URL}/${video.id}/captions/generate`, body)
          .pipe(
            map(() => 'success' as const),
            catchError(err => {
              const error: PeerTubeProblemDocument = err.error

              if (error?.code === ServerErrorCode.VIDEO_ALREADY_BEING_TRANSCRIBED) return of('conflict' as const)
              if (error?.code === ServerErrorCode.VIDEO_ALREADY_HAS_CAPTIONS) return of('already-has-captions' as const)

              return this.restExtractor.handleError(err)
            })
          )
      },

      confirmForce: conflicts => this.confirmForceTranscription(conflicts)
    }).pipe(
      map(outcomes => ({
        success: countVideoForceRunOutcomes(outcomes, 'success'),
        alreadyHasCaptions: countVideoForceRunOutcomes(outcomes, 'already-has-captions'),
        alreadyBeingTranscribed: countVideoForceRunOutcomes(outcomes, 'skipped'),
        failures: getVideoForceRunFailures(outcomes)
      }))
    )
  }

  private confirmForceTranscription (videos: Video[]) {
    return confirmVideosForce({
      confirmService: this.confirmService,
      videos,
      action: $localize`Force transcription`,

      singleVideoMessage: name =>
        $localize`PeerTube considers video "${name}" is already being transcribed.` +
        $localize` If you think PeerTube is wrong (video in broken state after a crash etc.), you can force transcription on this video.` +
        $localize` Do you still want to run transcription?`,

      multipleVideosMessage: count =>
        formatICU(
          $localize`PeerTube considers {count, plural, =1 {1 video is} other {{count} videos are}} already being transcribed.`,
          { count }
        ) +
        // eslint-disable-next-line max-len
        $localize` If you think PeerTube is wrong (videos in broken state after a crash etc.), you can force transcription on these videos.` +
        $localize` Otherwise they will be skipped. Do you want to force transcription?`
    })
  }
}
