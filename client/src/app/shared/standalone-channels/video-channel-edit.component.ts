import { CommonModule } from '@angular/common'
import { Component, inject, input, OnInit, output } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { PlayerChannelSettings } from '@peertube/peertube-models'
import { BuildFormArgumentTyped, FormReactiveErrorsTyped, FormReactiveMessagesTyped } from '../form-validators/form-validator.model'
import {
  VIDEO_CHANNEL_DESCRIPTION_VALIDATOR,
  VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR,
  VIDEO_CHANNEL_NAME_VALIDATOR,
  VIDEO_CHANNEL_SUPPORT_VALIDATOR
} from '../form-validators/video-channel-validators'
import { ActorAvatarEditComponent } from '../shared-actor-image-edit/actor-avatar-edit.component'
import { ActorBannerEditComponent } from '../shared-actor-image-edit/actor-banner-edit.component'
import { FormReactiveService } from '../shared-forms/form-reactive.service'
import { MarkdownTextareaComponent } from '../shared-forms/markdown-textarea.component'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { SelectPlayerThemeComponent } from '../shared-forms/select/select-player-theme.component'
import { HelpComponent } from '../shared-main/buttons/help.component'
import { AlertComponent } from '../shared-main/common/alert.component'
import { MarkdownHintComponent } from '../shared-main/text/markdown-hint.component'

type Form = {
  name: FormControl<string>
  displayName: FormControl<string>
  description: FormControl<string>,
  isApproved: FormControl<boolean>,
  support: FormControl<string>
  playerTheme: FormControl<PlayerChannelSettings['theme']>
  bulkVideosSupportUpdate: FormControl<boolean>
}

export type FormValidatedOutput = {
  avatar: FormData
  banner: FormData

  playerSettings: {
    theme: PlayerChannelSettings['theme']
  }

  channel: {
    name: string
    displayName: string
    description: string
    support: string,
    isApproved: boolean,
    bulkVideosSupportUpdate: boolean
  }
}

@Component({
  selector: 'my-video-channel-edit',
  templateUrl: './video-channel-edit.component.html',
  styleUrls: [ './video-channel-edit.component.scss' ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ActorBannerEditComponent,
    ActorAvatarEditComponent,
    HelpComponent,
    MarkdownTextareaComponent,
    PeertubeCheckboxComponent,
    AlertComponent,
    MarkdownHintComponent,
    SelectPlayerThemeComponent
  ]
})
export class VideoChannelEditComponent implements OnInit {
  private formReactiveService = inject(FormReactiveService)

  readonly mode = input.required<'create' | 'update'>()
  readonly channel = input.required<VideoChannel>()
  readonly rawPlayerSettings = input.required<PlayerChannelSettings>()
  readonly error = input<string>()

  readonly formValidated = output<FormValidatedOutput>()

  form: FormGroup<Form>
  formErrors: FormReactiveErrorsTyped<Form> = {}
  validationMessages: FormReactiveMessagesTyped<Form> = {}

  private avatar: FormData
  private banner: FormData
  private oldSupportField: string

  ngOnInit () {
    this.buildForm()

    this.oldSupportField = this.channel().support
  }

  private buildForm () {
    const obj: BuildFormArgumentTyped<Form> = {
      name: this.mode() === 'create'
        ? VIDEO_CHANNEL_NAME_VALIDATOR
        : null,
      displayName: VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR,
      description: VIDEO_CHANNEL_DESCRIPTION_VALIDATOR,
      support: VIDEO_CHANNEL_SUPPORT_VALIDATOR,
      isApproved: null,
      bulkVideosSupportUpdate: null,
      playerTheme: null
    }

    const defaultValues = {
      displayName: this.channel().displayName,
      description: this.channel().description,
      support: this.channel().support,
      isApproved: this.channel().isApproved,
      playerTheme: this.rawPlayerSettings().theme
    }

    const {
      form,
      formErrors,
      validationMessages
    } = this.formReactiveService.buildForm<Form>(obj, defaultValues)

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages
  }

  getFormButtonTitle () {
    if (this.mode() === 'update') {
      return $localize`Update ${this.channel().name}`
    }

    return $localize`Create your channel`
  }

  onAvatarChange (formData: FormData) {
    this.avatar = formData
  }

  onAvatarDelete () {
    this.avatar = null
  }

  onBannerChange (formData: FormData) {
    this.banner = formData
  }

  onBannerDelete () {
    this.banner = null
  }

  get instanceHost () {
    return window.location.host
  }

  isBulkUpdateVideosDisplayed () {
    if (this.mode() === 'create') return false

    if (this.oldSupportField === undefined) return false

    return this.oldSupportField !== this.form.value.support
  }

  onFormValidated () {
    const body = this.form.value

    this.formValidated.emit({
      avatar: this.avatar,
      banner: this.banner,
      playerSettings: {
        theme: body.playerTheme
      },
      channel: {
        name: body.name,
        displayName: body.displayName,
        description: body.description || null,
        support: body.support || null,
        isApproved: body.isApproved || false,

        bulkVideosSupportUpdate: this.mode() === 'update'
          ? body.bulkVideosSupportUpdate || false
          : undefined
      }
    })
  }
}
