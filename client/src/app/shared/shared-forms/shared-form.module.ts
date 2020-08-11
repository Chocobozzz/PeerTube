
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { InputMaskModule } from 'primeng/inputmask'
import { InputSwitchModule } from 'primeng/inputswitch'
import { NgSelectModule } from '@ng-select/ng-select'
import { BatchDomainsValidatorsService } from '@app/shared/shared-forms/form-validators/batch-domains-validators.service'
import { SharedGlobalIconModule } from '../shared-icons'
import { SharedMainModule } from '../shared-main/shared-main.module'
import {
  CustomConfigValidatorsService,
  FormValidatorService,
  InstanceValidatorsService,
  LoginValidatorsService,
  ResetPasswordValidatorsService,
  UserValidatorsService,
  AbuseValidatorsService,
  VideoAcceptOwnershipValidatorsService,
  VideoBlockValidatorsService,
  VideoCaptionsValidatorsService,
  VideoChangeOwnershipValidatorsService,
  VideoChannelValidatorsService,
  VideoCommentValidatorsService,
  VideoPlaylistValidatorsService,
  VideoValidatorsService
} from './form-validators'
import { InputReadonlyCopyComponent } from './input-readonly-copy.component'
import { MarkdownTextareaComponent } from './markdown-textarea.component'
import { PeertubeCheckboxComponent } from './peertube-checkbox.component'
import { PreviewUploadComponent } from './preview-upload.component'
import { ReactiveFileComponent } from './reactive-file.component'
import { TextareaAutoResizeDirective } from './textarea-autoresize.directive'
import { TimestampInputComponent } from './timestamp-input.component'
import { SelectChannelComponent, SelectCheckboxComponent, SelectOptionsComponent, SelectTagsComponent } from './select'

@NgModule({
  imports: [
    FormsModule,
    ReactiveFormsModule,

    InputMaskModule,
    InputSwitchModule,
    NgSelectModule,

    SharedMainModule,
    SharedGlobalIconModule
  ],

  declarations: [
    InputReadonlyCopyComponent,
    MarkdownTextareaComponent,
    PeertubeCheckboxComponent,
    PreviewUploadComponent,
    ReactiveFileComponent,
    TextareaAutoResizeDirective,
    TimestampInputComponent,

    SelectChannelComponent,
    SelectOptionsComponent,
    SelectTagsComponent,
    SelectCheckboxComponent
  ],

  exports: [
    FormsModule,
    ReactiveFormsModule,

    InputMaskModule,
    InputSwitchModule,
    NgSelectModule,

    InputReadonlyCopyComponent,
    MarkdownTextareaComponent,
    PeertubeCheckboxComponent,
    PreviewUploadComponent,
    ReactiveFileComponent,
    TextareaAutoResizeDirective,
    TimestampInputComponent,

    SelectChannelComponent,
    SelectOptionsComponent,
    SelectTagsComponent,
    SelectCheckboxComponent
  ],

  providers: [
    CustomConfigValidatorsService,
    FormValidatorService,
    LoginValidatorsService,
    InstanceValidatorsService,
    LoginValidatorsService,
    ResetPasswordValidatorsService,
    UserValidatorsService,
    AbuseValidatorsService,
    VideoAcceptOwnershipValidatorsService,
    VideoBlockValidatorsService,
    VideoCaptionsValidatorsService,
    VideoChangeOwnershipValidatorsService,
    VideoChannelValidatorsService,
    VideoCommentValidatorsService,
    VideoPlaylistValidatorsService,
    VideoValidatorsService,
    BatchDomainsValidatorsService
  ]
})
export class SharedFormModule { }
