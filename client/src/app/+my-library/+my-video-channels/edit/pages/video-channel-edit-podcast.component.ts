import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, effect, inject, Injector, OnDestroy, OnInit, signal } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { email, form, FormField } from '@angular/forms/signals'
import { ServerService } from '@app/core'
import { FormErrorComponent } from '@app/shared/shared-forms/form-error.component'
import { FormInputErrorDirective } from '@app/shared/shared-forms/form-input-error.directive'
import { InputTextComponent } from '@app/shared/shared-forms/input-text.component'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { getChannelPodcastFeed } from '@peertube/peertube-core-utils'
import { VideoResolution } from '@peertube/peertube-models'
import { Subscription } from 'rxjs'
import { environment } from '../../../../../environments/environment'
import { VideoChannelEditControllerService } from '../video-channel-edit-controller.service'
import { VideoChannelEdit } from '../video-channel-edit.model'

@Component({
  selector: 'my-video-channel-edit-podcast',
  templateUrl: './video-channel-edit-podcast.component.html',
  styleUrls: [ './video-channel-edit-podcast.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    GlobalIconComponent,
    InputTextComponent,
    FormErrorComponent,
    FormField,
    FormInputErrorDirective,
    AlertComponent
  ]
})
export class VideoChannelEditPodcastComponent implements OnInit, OnDestroy {
  private readonly injector = inject(Injector)
  private readonly server = inject(ServerService)

  private editController = inject(VideoChannelEditControllerService)

  videoChannelEdit: VideoChannelEdit

  readonly formModel = signal<{ publicEmail: string }>({
    publicEmail: null
  })

  readonly form = form(this.formModel, f => {
    email(f.publicEmail, { message: $localize`Email must be valid.` })
  })

  mode: string

  private storeSub: Subscription
  private formSub: Subscription

  get videoFeedUrl () {
    return getChannelPodcastFeed(environment.originServerUrl, { id: this.videoChannelEdit.apiInfo.id }, 'video')
  }

  get audioFeedUrl () {
    return getChannelPodcastFeed(environment.originServerUrl, { id: this.videoChannelEdit.apiInfo.id }, 'audio')
  }

  get podcastFeedUrl () {
    return getChannelPodcastFeed(environment.originServerUrl, { id: this.videoChannelEdit.apiInfo.id })
  }

  ngOnInit () {
    this.mode = this.editController.getMode()

    this.videoChannelEdit = this.editController.getStore()

    this.buildForm()

    this.storeSub = this.editController.getStoreChangesObs()
      .subscribe(() => {
        this.videoChannelEdit = this.editController.getStore()

        this.buildForm()
      })

    this.editController.registerSaveHook(() => {
      this.editController.setFormError($localize`Podcast`, 'podcast', this.form().errorSummary())
    })

    let firstRun = true

    effect(() => {
      // Register signal to trigger effect when form model changes
      const model = this.formModel()

      if (firstRun) {
        firstRun = false
        return
      }

      setTimeout(() => {
        this.editController.setFormError($localize`Podcast`, 'podcast', {})

        this.videoChannelEdit.loadFromPodcastForm({
          channel: {
            publicEmail: model.publicEmail || null
          }
        })
      })
    }, { injector: this.injector })
  }

  ngOnDestroy () {
    this.storeSub?.unsubscribe()
    this.formSub?.unsubscribe()
  }

  private buildForm () {
    this.formModel.set({
      publicEmail: this.videoChannelEdit.channel.publicEmail
    })
  }

  hasAudioTranscodingEnabled () {
    const config = this.server.getHTMLConfig().transcoding

    // Transcode to an audio resolution
    if (
      (config.web_videos.enabled || config.hls.enabled) &&
      (config.enabledResolutions.includes(VideoResolution.H_NOVIDEO) || config.alwaysTranscodePodcastOptimizedAudio)
    ) return true

    // Or if HLS transcoding splits audio and video streams
    if (config.hls.enabled && config.hls.splitAudioAndVideo) return true

    return false
  }
}
