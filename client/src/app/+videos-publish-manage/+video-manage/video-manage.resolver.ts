import { Injectable, inject } from '@angular/core'
import { ActivatedRouteSnapshot } from '@angular/router'
import { AuthService, ServerService, UserService } from '@app/core'
import { listUserChannelsForSelect } from '@app/helpers'
import { VideoCaptionService } from '@app/shared/shared-main/video-caption/video-caption.service'
import { VideoChapterService } from '@app/shared/shared-main/video/video-chapter.service'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { VideoPasswordService } from '@app/shared/shared-main/video/video-password.service'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { LiveVideoService } from '@app/shared/shared-video-live/live-video.service'
import {
  LiveVideo,
  UserVideoQuota,
  VideoCaption,
  VideoChapter,
  VideoConstant,
  VideoPassword,
  VideoPrivacy,
  VideoPrivacyType,
  VideoSource
} from '@peertube/peertube-models'
import { forkJoin, of } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { SelectChannelItem } from '../../../types'

export type VideoManageResolverData = {
  video: VideoDetails
  videoSource: VideoSource
  userChannels: SelectChannelItem[]
  captions: VideoCaption[]
  chapters: VideoChapter[]
  live: LiveVideo
  videoPasswords: VideoPassword[]
  userQuota: UserVideoQuota
  privacies: VideoConstant<VideoPrivacyType>[]
}

@Injectable()
export class VideoManageResolver {
  private videoService = inject(VideoService)
  private liveVideoService = inject(LiveVideoService)
  private authService = inject(AuthService)
  private videoCaptionService = inject(VideoCaptionService)
  private videoChapterService = inject(VideoChapterService)
  private videoPasswordService = inject(VideoPasswordService)
  private userService = inject(UserService)
  private serverService = inject(ServerService)

  resolve (route: ActivatedRouteSnapshot) {
    const uuid: string = route.params['uuid']

    return this.videoService.getVideo({ videoId: uuid })
      .pipe(
        switchMap(video => forkJoin(this.buildObservables(video))),
        map(([ video, videoSource, userChannels, captions, chapters, live, videoPasswords, userQuota, privacies ]) =>
          ({
            video,
            userChannels,
            captions,
            chapters,
            videoSource,
            live,
            videoPasswords,
            userQuota,
            privacies
          }) as VideoManageResolverData
        )
      )
  }

  private buildObservables (video: VideoDetails) {
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
        : of([]),

      this.userService.getMyVideoQuotaUsed(),

      this.serverService.getVideoPrivacies()
    ]
  }
}
