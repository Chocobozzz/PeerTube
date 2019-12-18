import { EventEmitter, OnInit } from '@angular/core'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { AuthService, Notifier, ServerService } from '@app/core'
import { catchError, switchMap, tap } from 'rxjs/operators'
import { FormReactive } from '@app/shared'
import { ServerConfig, VideoConstant, VideoPrivacy } from '../../../../../../shared'
import { VideoService } from '@app/shared/video/video.service'
import { VideoCaptionEdit } from '@app/shared/video-caption/video-caption-edit.model'
import { VideoCaptionService } from '@app/shared/video-caption'
import { VideoEdit } from '@app/shared/video/video-edit.model'
import { populateAsyncUserVideoChannels } from '@app/shared/misc/utils'
import { CanComponentDeactivateResult } from '@app/shared/guards/can-deactivate-guard.service'

export abstract class VideoSend extends FormReactive implements OnInit {
  userVideoChannels: { id: number, label: string, support: string }[] = []
  videoPrivacies: VideoConstant<VideoPrivacy>[] = []
  videoCaptions: VideoCaptionEdit[] = []

  firstStepPrivacyId = 0
  firstStepChannelId = 0

  abstract firstStepDone: EventEmitter<string>
  abstract firstStepError: EventEmitter<void>
  protected abstract readonly DEFAULT_VIDEO_PRIVACY: VideoPrivacy

  protected loadingBar: LoadingBarService
  protected notifier: Notifier
  protected authService: AuthService
  protected serverService: ServerService
  protected videoService: VideoService
  protected videoCaptionService: VideoCaptionService
  protected serverConfig: ServerConfig

  abstract canDeactivate (): CanComponentDeactivateResult

  ngOnInit () {
    this.buildForm({})

    populateAsyncUserVideoChannels(this.authService, this.userVideoChannels)
      .then(() => this.firstStepChannelId = this.userVideoChannels[ 0 ].id)

    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
        .subscribe(config => this.serverConfig = config)

    this.serverService.getVideoPrivacies()
        .subscribe(
          privacies => {
            this.videoPrivacies = privacies

            this.firstStepPrivacyId = this.DEFAULT_VIDEO_PRIVACY
          })
  }

  checkForm () {
    this.forceCheck()

    return this.form.valid
  }

  protected updateVideoAndCaptions (video: VideoEdit) {
    this.loadingBar.start()

    return this.videoService.updateVideo(video)
        .pipe(
          // Then update captions
          switchMap(() => this.videoCaptionService.updateCaptions(video.id, this.videoCaptions)),
          tap(() => this.loadingBar.complete()),
          catchError(err => {
            this.loadingBar.complete()
            throw err
          })
        )
  }
}
