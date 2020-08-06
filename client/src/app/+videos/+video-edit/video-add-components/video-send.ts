import { catchError, switchMap, tap } from 'rxjs/operators'
import { Directive, EventEmitter, OnInit } from '@angular/core'
import { AuthService, CanComponentDeactivateResult, Notifier, ServerService } from '@app/core'
import { populateAsyncUserVideoChannels } from '@app/helpers'
import { FormReactive } from '@app/shared/shared-forms'
import { VideoCaptionEdit, VideoCaptionService, VideoEdit, VideoService } from '@app/shared/shared-main'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { ServerConfig, VideoConstant, VideoPrivacy } from '@shared/models'

@Directive()
// tslint:disable-next-line: directive-class-suffix
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
    this.loadingBar.useRef().start()

    return this.videoService.updateVideo(video)
        .pipe(
          // Then update captions
          switchMap(() => this.videoCaptionService.updateCaptions(video.id, this.videoCaptions)),
          tap(() => this.loadingBar.useRef().complete()),
          catchError(err => {
            this.loadingBar.useRef().complete()
            throw err
          })
        )
  }
}
