
import { InputMaskModule } from 'primeng/inputmask'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { NgSelectModule } from '@ng-select/ng-select'
import { SharedGlobalIconModule } from '../shared-icons'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { DynamicFormFieldComponent } from './dynamic-form-field.component'
import { FormValidatorService } from './form-validator.service'
import { InputReadonlyCopyComponent } from './input-readonly-copy.component'
import { InputSwitchComponent } from './input-switch.component'
import { MarkdownTextareaComponent } from './markdown-textarea.component'
import { PeertubeCheckboxComponent } from './peertube-checkbox.component'
import { PreviewUploadComponent } from './preview-upload.component'
import { ReactiveFileComponent } from './reactive-file.component'
import { SelectChannelComponent, SelectCheckboxComponent, SelectOptionsComponent, SelectTagsComponent } from './select'
import { TextareaAutoResizeDirective } from './textarea-autoresize.directive'
import { TimestampInputComponent } from './timestamp-input.component'

@NgModule({
  imports: [
    FormsModule,
    ReactiveFormsModule,

    InputMaskModule,
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

    InputSwitchComponent,

    SelectChannelComponent,
    SelectOptionsComponent,
    SelectTagsComponent,
    SelectCheckboxComponent,

    DynamicFormFieldComponent
  ],

  exports: [
    FormsModule,
    ReactiveFormsModule,

    InputMaskModule,
    NgSelectModule,

    InputReadonlyCopyComponent,
    MarkdownTextareaComponent,
    PeertubeCheckboxComponent,
    PreviewUploadComponent,
    ReactiveFileComponent,
    TextareaAutoResizeDirective,
    TimestampInputComponent,

    InputSwitchComponent,

    SelectChannelComponent,
    SelectOptionsComponent,
    SelectTagsComponent,
    SelectCheckboxComponent,

    DynamicFormFieldComponent
  ],

  providers: [
    FormValidatorService
  ]
})
export class SharedFormModule { }
