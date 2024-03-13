import { catchError, switchMap, tap } from 'rxjs/operators'
import { SelectChannelItem } from 'src/types/select-options-item.model'
import { Directive, EventEmitter, OnInit } from '@angular/core'
import { AuthService, CanComponentDeactivateResult, Notifier, ServerService } from '@app/core'
import { listUserChannelsForSelect } from '@app/helpers'
import { LoadingBarService } from '@ngx-loading-bar/core'
import { HTMLServerConfig, VideoConstant, VideoPrivacyType } from '@peertube/peertube-models'
import { of } from 'rxjs'
import { VideoCaptionEdit } from '@app/shared/shared-main/video-caption/video-caption-edit.model'
import { VideoCaptionService } from '@app/shared/shared-main/video-caption/video-caption.service'
import { VideoChapterService } from '@app/shared/shared-main/video/video-chapter.service'
import { VideoChaptersEdit } from '@app/shared/shared-main/video/video-chapters-edit.model'
import { VideoEdit } from '@app/shared/shared-main/video/video-edit.model'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'

@Directive()
// eslint-disable-next-line @angular-eslint/directive-class-suffix
export abstract class VideoSend extends FormReactive implements OnInit {
  userVideoChannels: SelectChannelItem[] = []
  videoPrivacies: VideoConstant<VideoPrivacyType>[] = []
  videoCaptions: VideoCaptionEdit[] = []
  chaptersEdit = new VideoChaptersEdit()

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
  protected videoChapterService: VideoChapterService

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

  protected updateVideoAndCaptionsAndChapters (options: {
    video: VideoEdit
    captions: VideoCaptionEdit[]
    chapters?: VideoChaptersEdit
  }) {
    const { video, captions, chapters } = options

    this.loadingBar.useRef().start()

    return this.videoService.updateVideo(video)
        .pipe(
          switchMap(() => this.videoCaptionService.updateCaptions(video.uuid, captions)),
          switchMap(() => {
            return chapters
              ? this.videoChapterService.updateChapters(video.uuid, chapters)
              : of(true)
          }),
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
