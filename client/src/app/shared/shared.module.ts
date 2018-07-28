import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'
import { MarkdownTextareaComponent } from '@app/shared/forms/markdown-textarea.component'
import { HelpComponent } from '@app/shared/misc/help.component'
import { InfiniteScrollerDirective } from '@app/shared/video/infinite-scroller.directive'
import { MarkdownService } from '@app/videos/shared'

import { BsDropdownModule } from 'ngx-bootstrap/dropdown'
import { ModalModule } from 'ngx-bootstrap/modal'
import { PopoverModule } from 'ngx-bootstrap/popover'
import { TabsModule } from 'ngx-bootstrap/tabs'
import { TooltipModule } from 'ngx-bootstrap/tooltip'
import { BytesPipe, KeysPipe, NgPipesModule } from 'ngx-pipes'
import { SharedModule as PrimeSharedModule } from 'primeng/components/common/shared'

import { AUTH_INTERCEPTOR_PROVIDER } from './auth'
import { DeleteButtonComponent } from './misc/delete-button.component'
import { EditButtonComponent } from './misc/edit-button.component'
import { FromNowPipe } from './misc/from-now.pipe'
import { LoaderComponent } from './misc/loader.component'
import { NumberFormatterPipe } from './misc/number-formatter.pipe'
import { ObjectLengthPipe } from './misc/object-length.pipe'
import { RestExtractor, RestService } from './rest'
import { UserService } from './users'
import { VideoAbuseService } from './video-abuse'
import { VideoBlacklistService } from './video-blacklist'
import { VideoMiniatureComponent } from './video/video-miniature.component'
import { VideoFeedComponent } from './video/video-feed.component'
import { VideoThumbnailComponent } from './video/video-thumbnail.component'
import { VideoService } from './video/video.service'
import { AccountService } from '@app/shared/account/account.service'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import {
  CustomConfigValidatorsService,
  LoginValidatorsService,
  ReactiveFileComponent,
  ResetPasswordValidatorsService,
  UserValidatorsService,
  VideoAbuseValidatorsService,
  VideoChannelValidatorsService,
  VideoCommentValidatorsService,
  VideoValidatorsService
} from '@app/shared/forms'
import { I18nPrimengCalendarService } from '@app/shared/i18n/i18n-primeng-calendar'
import { ScreenService } from '@app/shared/misc/screen.service'
import { VideoCaptionsValidatorsService } from '@app/shared/forms/form-validators/video-captions-validators.service'
import { VideoCaptionService } from '@app/shared/video-caption'
import { PeertubeCheckboxComponent } from '@app/shared/forms/peertube-checkbox.component'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,

    BsDropdownModule.forRoot(),
    ModalModule.forRoot(),
    PopoverModule.forRoot(),
    TabsModule.forRoot(),
    TooltipModule.forRoot(),

    PrimeSharedModule,
    NgPipesModule
  ],

  declarations: [
    LoaderComponent,
    VideoThumbnailComponent,
    VideoMiniatureComponent,
    VideoFeedComponent,
    DeleteButtonComponent,
    EditButtonComponent,
    NumberFormatterPipe,
    ObjectLengthPipe,
    FromNowPipe,
    MarkdownTextareaComponent,
    InfiniteScrollerDirective,
    HelpComponent,
    ReactiveFileComponent,
    PeertubeCheckboxComponent
  ],

  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,

    BsDropdownModule,
    ModalModule,
    PopoverModule,
    TabsModule,
    TooltipModule,
    PrimeSharedModule,
    BytesPipe,
    KeysPipe,

    LoaderComponent,
    VideoThumbnailComponent,
    VideoMiniatureComponent,
    VideoFeedComponent,
    DeleteButtonComponent,
    EditButtonComponent,
    MarkdownTextareaComponent,
    InfiniteScrollerDirective,
    HelpComponent,
    ReactiveFileComponent,
    PeertubeCheckboxComponent,

    NumberFormatterPipe,
    ObjectLengthPipe,
    FromNowPipe
  ],

  providers: [
    AUTH_INTERCEPTOR_PROVIDER,
    RestExtractor,
    RestService,
    VideoAbuseService,
    VideoBlacklistService,
    UserService,
    VideoService,
    AccountService,
    MarkdownService,
    VideoChannelService,
    VideoCaptionService,

    FormValidatorService,
    CustomConfigValidatorsService,
    LoginValidatorsService,
    ResetPasswordValidatorsService,
    UserValidatorsService,
    VideoAbuseValidatorsService,
    VideoChannelValidatorsService,
    VideoCommentValidatorsService,
    VideoValidatorsService,
    VideoCaptionsValidatorsService,

    I18nPrimengCalendarService,
    ScreenService,

    I18n
  ]
})
export class SharedModule { }
