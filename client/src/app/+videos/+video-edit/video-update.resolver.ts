import { forkJoin, of } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot } from '@angular/router'
import { AuthService } from '@app/core'
import { listUserChannelsForSelect } from '@app/helpers'
import { VideoPrivacy } from '@peertube/peertube-models'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { VideoCaptionService } from '@app/shared/shared-main/video-caption/video-caption.service'
import { VideoChapterService } from '@app/shared/shared-main/video/video-chapter.service'
import { VideoPasswordService } from '@app/shared/shared-main/video/video-password.service'
import { LiveVideoService } from '@app/shared/shared-video-live/live-video.service'

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
      of(video),

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
