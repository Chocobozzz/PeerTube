import { CommonModule } from '@angular/common'
import { Component, inject, OnDestroy, OnInit } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import {
  BuildFormArgumentTyped,
  FormReactiveErrorsTyped,
  FormReactiveMessagesTyped
} from '@app/shared/form-validators/form-validator.model'
import {
  VIDEO_CHANNEL_DESCRIPTION_VALIDATOR,
  VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR,
  VIDEO_CHANNEL_NAME_VALIDATOR,
  VIDEO_CHANNEL_SUPPORT_VALIDATOR
} from '@app/shared/form-validators/video-channel-validators'
import { ActorAvatarEditComponent } from '@app/shared/shared-actor-image-edit/actor-avatar-edit.component'
import { ActorBannerEditComponent } from '@app/shared/shared-actor-image-edit/actor-banner-edit.component'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { MarkdownTextareaComponent } from '@app/shared/shared-forms/markdown-textarea.component'
import { PeertubeCheckboxComponent } from '@app/shared/shared-forms/peertube-checkbox.component'
import { SelectPlayerThemeComponent } from '@app/shared/shared-forms/select/select-player-theme.component'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { HelpComponent } from '@app/shared/shared-main/buttons/help.component'
import { MarkdownHintComponent } from '@app/shared/shared-main/text/markdown-hint.component'
import { PlayerChannelSettings } from '@peertube/peertube-models'
import { Subscription } from 'rxjs'
import { EditMode, VideoChannelEditControllerService } from '../video-channel-edit-controller.service'
import { VideoChannelEdit } from '../video-channel-edit.model'

type Form = {
  name: FormControl<string>
  displayName: FormControl<string>
  description: FormControl<string>
  support: FormControl<string>
  playerTheme: FormControl<PlayerChannelSettings['theme']>
  bulkVideosSupportUpdate: FormControl<boolean>
}

@Component({
  selector: 'my-video-channel-edit-general',
  templateUrl: './video-channel-edit-general.component.html',
  styleUrls: [ './video-channel-edit-general.component.scss' ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ActorBannerEditComponent,
    ActorAvatarEditComponent,
    HelpComponent,
    MarkdownTextareaComponent,
    PeertubeCheckboxComponent,
    MarkdownHintComponent,
    SelectPlayerThemeComponent,
    GlobalIconComponent
  ]
})
export class VideoChannelEditGeneralComponent implements OnInit, OnDestroy {
  private formReactiveService = inject(FormReactiveService)
  private editController = inject(VideoChannelEditControllerService)

  form: FormGroup<Form>
  formErrors: FormReactiveErrorsTyped<Form> = {}
  validationMessages: FormReactiveMessagesTyped<Form> = {}
  mode: EditMode
  videoChannelEdit: VideoChannelEdit

  private formSub: Subscription
  private storeSub: Subscription

  get instanceHost () {
    return window.location.host
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
      this.formReactiveService.forceCheck(this.form, this.formErrors, this.validationMessages)

      this.editController.setFormError($localize`General`, 'general', this.formErrors)
    })
  }

  ngOnDestroy () {
    this.storeSub?.unsubscribe()
    this.editController.unregisterSaveHook()
  }

  private buildForm () {
    this.formSub?.unsubscribe()

    const obj: BuildFormArgumentTyped<Form> = {
      name: this.mode === 'create'
        ? VIDEO_CHANNEL_NAME_VALIDATOR
        : null,

      displayName: VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR,
      description: VIDEO_CHANNEL_DESCRIPTION_VALIDATOR,
      support: VIDEO_CHANNEL_SUPPORT_VALIDATOR,
      bulkVideosSupportUpdate: null,
      playerTheme: null
    }

    const defaultValues = {
      name: this.videoChannelEdit.channel.name,
      displayName: this.videoChannelEdit.channel.displayName,
      description: this.videoChannelEdit.channel.description,
      support: this.videoChannelEdit.channel.support,
      playerTheme: this.videoChannelEdit.playerSettings.theme
    }

    const {
      form,
      formErrors,
      validationMessages
    } = this.formReactiveService.buildForm<Form>(obj, defaultValues)

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages

    this.subscribeToFormChanges()
  }

  getFormButtonTitle () {
    if (this.mode === 'update') {
      return $localize`Manage ${this.videoChannelEdit.channel.displayName}`
    }

    return $localize`Create your channel`
  }

  // ---------------------------------------------------------------------------

  onAvatarChange (formData: FormData) {
    this.videoChannelEdit.updateAvatarFromGeneralForm(formData)
  }

  onAvatarDelete () {
    this.videoChannelEdit.updateAvatarFromGeneralForm(null)
  }

  onBannerChange (formData: FormData) {
    this.videoChannelEdit.updateBannerFromGeneralForm(formData)
  }

  onBannerDelete () {
    this.videoChannelEdit.updateBannerFromGeneralForm(null)
  }

  // ---------------------------------------------------------------------------

  isBulkUpdateVideosDisplayed () {
    if (this.mode === 'create') return false

    if (this.videoChannelEdit.apiInfo.support === undefined) return false

    return this.videoChannelEdit.apiInfo.support !== this.form.value.support
  }

  subscribeToFormChanges () {
    this.formSub = this.form.valueChanges.subscribe(body => {
      // Reset form errors, we'll re-check them on save
      this.editController.setFormError($localize`General`, 'general', {})

      this.videoChannelEdit.loadFromGeneralForm({
        playerSettings: {
          theme: body.playerTheme
        },

        channel: {
          name: body.name,
          displayName: body.displayName,
          description: body.description || null,
          support: body.support || null,

          bulkVideosSupportUpdate: this.mode === 'update'
            ? body.bulkVideosSupportUpdate || false
            : undefined
        }
      })
    })
  }
}
