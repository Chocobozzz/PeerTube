import { catchError, switchMap, tap } from 'rxjs/operators'
import { SelectChannelItem } from 'src/types/select-options-item.model'
import { Directive, EventEmitter, OnInit } from '@angular/core'
import { AuthService, CanComponentDeactivateResult, Notifier, ServerService } from '@app/core'
import { listUserChannels } from '@app/helpers'
import { FormReactive } from '@app/shared/shared-forms'
import { VideoCaptionEdit, VideoCaptionService, VideoEdit, VideoService } from '@app/shared/shared-main'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { HTMLServerConfig, VideoConstant, VideoPrivacy } from '@shared/models'

@Directive()
// tslint:disable-next-line: directive-class-suffix
export abstract class VideoSend extends FormReactive implements OnInit {
  userVideoChannels: SelectChannelItem[] = []
  videoPrivacies: VideoConstant<VideoPrivacy>[] = []
  videoCaptions: VideoCaptionEdit[] = []

  firstStepPrivacyId = 0
  firstStepChannelId = 0

  abstract firstStepDone: EventEmitter<string>
  abstract firstStepError: EventEmitter<void>

  protected loadingBar: LoadingBarService
  protected notifier: Notifier
  protected authService: AuthService
  protected serverService: ServerService
  protected videoService: VideoService
  protected videoCaptionService: VideoCaptionService
  protected serverConfig: HTMLServerConfig

  abstract canDeactivate (): CanComponentDeactivateResult

  ngOnInit () {
    this.buildForm({})

    listUserChannels(this.authService)
      .subscribe(channels => {
        this.userVideoChannels = channels
        this.firstStepChannelId = this.userVideoChannels[0].id
      })

    this.serverConfig = this.serverService.getHTMLConfig()

    this.serverService.getVideoPrivacies()
        .subscribe(
          privacies => {
            const { videoPrivacies, defaultPrivacyId } = this.videoService.explainedPrivacyLabels(privacies)

            this.videoPrivacies = videoPrivacies
            this.firstStepPrivacyId = defaultPrivacyId
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
