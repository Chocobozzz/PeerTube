import { Injectable, inject } from '@angular/core'
import { ActivatedRouteSnapshot, Router } from '@angular/router'
import { AuthService, ServerService, UserService } from '@app/core'
import { listUserChannelsForSelect } from '@app/helpers'
import { VideoCaptionService } from '@app/shared/shared-main/video-caption/video-caption.service'
import { VideoChapterService } from '@app/shared/shared-main/video/video-chapter.service'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { VideoPasswordService } from '@app/shared/shared-main/video/video-password.service'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { LiveVideoService } from '@app/shared/shared-video-live/live-video.service'
import { PlayerSettingsService } from '@app/shared/shared-video/player-settings.service'
import {
  LiveVideo,
  PlayerVideoSettings,
  UserVideoQuota,
  VideoCaption,
  VideoChapter,
  VideoConstant,
  VideoPassword,
  VideoPrivacy,
  VideoPrivacyType,
  VideoSource
} from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { forkJoin, of, throwError } from 'rxjs'
import { catchError, map, switchMap } from 'rxjs/operators'
import { SelectChannelItem } from '../../../types'
import { VideoEdit } from '../shared-manage/common/video-edit.model'

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
  videoEdit: VideoEdit
  playerSettings: PlayerVideoSettings
}

@Injectable()
export class VideoManageResolver {
  private router = inject(Router)
  private videoService = inject(VideoService)
  private liveVideoService = inject(LiveVideoService)
  private authService = inject(AuthService)
  private videoCaptionService = inject(VideoCaptionService)
  private videoChapterService = inject(VideoChapterService)
  private videoPasswordService = inject(VideoPasswordService)
  private userService = inject(UserService)
  private serverService = inject(ServerService)
  private playerSettingsService = inject(PlayerSettingsService)

  resolve (route: ActivatedRouteSnapshot) {
    const uuid: string = route.params['uuid']

    return this.videoService.getVideo({ videoId: uuid })
      .pipe(
        switchMap(video => forkJoin(this.buildObservables(video))),
        switchMap(
          async ([
            video,
            videoSource,
            allUserChannels,
            captions,
            chapters,
            live,
            videoPasswords,
            userQuota,
            privacies,
            playerSettings
          ]) => {
            const videoEdit = await VideoEdit.createFromAPI(this.serverService.getHTMLConfig(), {
              video,
              captions,
              chapters,
              live,
              videoSource,
              playerSettings,
              videoPasswords: videoPasswords.map(p => p.password)
            })

            return {
              video,
              userChannels: allUserChannels.filter(c => c.ownerAccountId === video.channel.ownerAccount.id),
              captions,
              chapters,
              videoSource,
              live,
              videoPasswords,
              userQuota,
              privacies,
              videoEdit,
              playerSettings
            } satisfies VideoManageResolverData
          }
        ),
        catchError(err => {
          logger.error('Cannot fetch video information', err)

          this.router.navigate([ '/401' ], { state: { obj: err }, skipLocationChange: true })

          return throwError(() => err)
        })
      )
  }

  private buildObservables (video: VideoDetails) {
    return [
      of(video),

      this.videoService.getSource(video.id),

      listUserChannelsForSelect(this.authService, { includeCollaborations: true }),

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
        : of([] as VideoPassword[]),

      this.userService.getMyVideoQuotaUsed(),

      this.serverService.getVideoPrivacies(),

      this.playerSettingsService.getVideoSettings({ videoId: video.uuid, raw: true })
    ] as const
  }
}
