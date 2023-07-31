import { catchError, switchMap, tap } from 'rxjs/operators'
import { SelectChannelItem } from 'src/types/select-options-item.model'
import { Directive, EventEmitter, OnInit } from '@angular/core'
import { AuthService, CanComponentDeactivateResult, Notifier, ServerService } from '@app/core'
import { listUserChannelsForSelect } from '@app/helpers'
import { FormReactive } from '@app/shared/shared-forms'
import { VideoCaptionEdit, VideoCaptionService, VideoEdit, VideoService } from '@app/shared/shared-main'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { HTMLServerConfig, VideoConstant, VideoPrivacyType } from '@peertube/peertube-models'

@Directive()
// eslint-disable-next-line @angular-eslint/directive-class-suffix
export abstract class VideoSend extends FormReactive implements OnInit {
  userVideoChannels: SelectChannelItem[] = []
  videoPrivacies: VideoConstant<VideoPrivacyType>[] = []
  videoCaptions: VideoCaptionEdit[] = []

  firstStepPrivacyId: VideoPrivacyType
  firstStepChannelId: number

  abstract firstStepDone: EventEmitter<string>
  abstract firstStepError: EventEmitter<void>

  protected loadingBar: LoadingBarService
  protected notifier: Notifier
  protected authService: AuthService

  protected serverService: ServerService
  protected videoService: VideoService
  protected videoCaptionService: VideoCaptionService

  protected serverConfig: HTMLServerConfig

  protected highestPrivacy: VideoPrivacyType

  abstract canDeactivate (): CanComponentDeactivateResult

  ngOnInit () {
    this.buildForm({})

    listUserChannelsForSelect(this.authService)
      .subscribe(channels => {
        this.userVideoChannels = channels
        this.firstStepChannelId = this.userVideoChannels[0].id
      })

    this.serverConfig = this.serverService.getHTMLConfig()

    this.serverService.getVideoPrivacies()
        .subscribe(
          privacies => {
            const defaultPrivacy = this.serverConfig.defaults.publish.privacy

            const { videoPrivacies, defaultPrivacyId } = this.videoService.explainedPrivacyLabels(privacies, defaultPrivacy)

            this.videoPrivacies = videoPrivacies
            this.firstStepPrivacyId = defaultPrivacyId

            this.highestPrivacy = this.videoService.getHighestAvailablePrivacy(privacies)
          })
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

  protected async isFormValid () {
    await this.waitPendingCheck()
    this.forceCheck()

    return this.form.valid
  }
}
