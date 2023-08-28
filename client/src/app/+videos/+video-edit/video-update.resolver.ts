import { forkJoin, of } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot } from '@angular/router'
import { AuthService } from '@app/core'
import { listUserChannelsForSelect } from '@app/helpers'
import { VideoCaptionService, VideoChapterService, VideoDetails, VideoPasswordService, VideoService } from '@app/shared/shared-main'
import { LiveVideoService } from '@app/shared/shared-video-live'
import { VideoPrivacy } from '@peertube/peertube-models'

@Injectable()
export class VideoUpdateResolver {
  constructor (
    private videoService: VideoService,
    private liveVideoService: LiveVideoService,
    private authService: AuthService,
    private videoCaptionService: VideoCaptionService,
    private videoChapterService: VideoChapterService,
    private videoPasswordService: VideoPasswordService
  ) {
  }

  resolve (route: ActivatedRouteSnapshot) {
    const uuid: string = route.params['uuid']

    return this.videoService.getVideo({ videoId: uuid })
                .pipe(
                  switchMap(video => forkJoin(this.buildVideoObservables(video))),
                  map(([ video, videoSource, videoChannels, videoCaptions, videoChapters, liveVideo, videoPassword ]) =>
                    ({ video, videoChannels, videoCaptions, videoChapters, videoSource, liveVideo, videoPassword }))
                )
  }

  private buildVideoObservables (video: VideoDetails) {
    return [
      this.videoService
        .loadCompleteDescription(video.descriptionPath)
        .pipe(map(description => Object.assign(video, { description }))),

      this.videoService.getSource(video.id),

      listUserChannelsForSelect(this.authService),

      this.videoCaptionService
        .listCaptions(video.uuid)
        .pipe(
          map(result => result.data)
        ),

      this.videoChapterService
        .getChapters({ videoId: video.uuid })
        .pipe(
          map(({ chapters }) => chapters)
        ),

      video.isLive
        ? this.liveVideoService.getVideoLive(video.id)
        : of(undefined),

      video.privacy.id === VideoPrivacy.PASSWORD_PROTECTED
        ? this.videoPasswordService.getVideoPasswords({ videoUUID: video.uuid })
        : of(undefined)
    ]
  }
}
