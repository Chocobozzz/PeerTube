import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'
import { MarkdownTextareaComponent } from '@app/shared/forms/markdown-textarea.component'
import { HelpComponent } from '@app/shared/misc/help.component'
import { InfiniteScrollerDirective } from '@app/shared/video/infinite-scroller.directive'

import { BytesPipe, KeysPipe, NgPipesModule } from 'ngx-pipes'
import { SharedModule as PrimeSharedModule } from 'primeng/components/common/shared'
import { KeyFilterModule } from 'primeng/keyfilter'

import { AUTH_INTERCEPTOR_PROVIDER } from './auth'
import { ButtonComponent } from './buttons/button.component'
import { DeleteButtonComponent } from './buttons/delete-button.component'
import { EditButtonComponent } from './buttons/edit-button.component'
import { FromNowPipe } from './misc/from-now.pipe'
import { LoaderComponent } from './misc/loader.component'
import { NumberFormatterPipe } from './misc/number-formatter.pipe'
import { ObjectLengthPipe } from './misc/object-length.pipe'
import { RestExtractor, RestService } from './rest'
import { UserService } from './users'
import { VideoAbuseService } from './video-abuse'
import { VideoBlacklistService } from './video-blacklist'
import { VideoOwnershipService } from './video-ownership'
import { VideoMiniatureComponent } from './video/video-miniature.component'
import { FeedComponent } from './video/feed.component'
import { VideoThumbnailComponent } from './video/video-thumbnail.component'
import { VideoService } from './video/video.service'
import { AccountService } from '@app/shared/account/account.service'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import {
  CustomConfigValidatorsService,
  InstanceValidatorsService,
  LoginValidatorsService,
  ReactiveFileComponent,
  ResetPasswordValidatorsService,
  TextareaAutoResizeDirective,
  UserValidatorsService,
  VideoAbuseValidatorsService,
  VideoAcceptOwnershipValidatorsService,
  VideoBlacklistValidatorsService,
  VideoChangeOwnershipValidatorsService,
  VideoChannelValidatorsService,
  VideoCommentValidatorsService,
  VideoPlaylistValidatorsService,
  VideoValidatorsService
} from '@app/shared/forms'
import { I18nPrimengCalendarService } from '@app/shared/i18n/i18n-primeng-calendar'
import { InputMaskModule } from 'primeng/inputmask'
import { ScreenService } from '@app/shared/misc/screen.service'
import { VideoCaptionsValidatorsService } from '@app/shared/forms/form-validators/video-captions-validators.service'
import { VideoCaptionService } from '@app/shared/video-caption'
import { PeertubeCheckboxComponent } from '@app/shared/forms/peertube-checkbox.component'
import { VideoImportService } from '@app/shared/video-import/video-import.service'
import { ActionDropdownComponent } from '@app/shared/buttons/action-dropdown.component'
import { NgbDropdownModule, NgbModalModule, NgbPopoverModule, NgbTabsetModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'
import { RemoteSubscribeComponent, SubscribeButtonComponent, UserSubscriptionService } from '@app/shared/user-subscription'
import { InstanceFeaturesTableComponent } from '@app/shared/instance/instance-features-table.component'
import { OverviewService } from '@app/shared/overview'
import { UserBanModalComponent } from '@app/shared/moderation'
import { UserModerationDropdownComponent } from '@app/shared/moderation/user-moderation-dropdown.component'
import { BlocklistService } from '@app/shared/blocklist'
import { TopMenuDropdownComponent } from '@app/shared/menu/top-menu-dropdown.component'
import { UserHistoryService } from '@app/shared/users/user-history.service'
import { UserNotificationService } from '@app/shared/users/user-notification.service'
import { UserNotificationsComponent } from '@app/shared/users/user-notifications.component'
import { InstanceService } from '@app/shared/instance/instance.service'
import { HtmlRendererService, LinkifierService, MarkdownService } from '@app/shared/renderer'
import { ConfirmComponent } from '@app/shared/confirm/confirm.component'
import { SmallLoaderComponent } from '@app/shared/misc/small-loader.component'
import { VideoPlaylistService } from '@app/shared/video-playlist/video-playlist.service'
import { ImageUploadComponent } from '@app/shared/images/image-upload.component'
import { GlobalIconComponent } from '@app/shared/images/global-icon.component'
import { VideoPlaylistMiniatureComponent } from '@app/shared/video-playlist/video-playlist-miniature.component'
import { VideoAddToPlaylistComponent } from '@app/shared/video-playlist/video-add-to-playlist.component'
import { TimestampInputComponent } from '@app/shared/forms/timestamp-input.component'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,

    NgbDropdownModule,
    NgbModalModule,
    NgbPopoverModule,
    NgbTabsetModule,
    NgbTooltipModule,

    PrimeSharedModule,
    InputMaskModule,
    KeyFilterModule,
    NgPipesModule
  ],

  declarations: [
    LoaderComponent,
    SmallLoaderComponent,

    VideoThumbnailComponent,
    VideoMiniatureComponent,
    VideoPlaylistMiniatureComponent,
    VideoAddToPlaylistComponent,

    FeedComponent,

    ButtonComponent,
    DeleteButtonComponent,
    EditButtonComponent,

    ActionDropdownComponent,
    NumberFormatterPipe,
    ObjectLengthPipe,
    FromNowPipe,
    MarkdownTextareaComponent,
    InfiniteScrollerDirective,
    TextareaAutoResizeDirective,
    HelpComponent,

    ReactiveFileComponent,
    PeertubeCheckboxComponent,
    TimestampInputComponent,

    SubscribeButtonComponent,
    RemoteSubscribeComponent,
    InstanceFeaturesTableComponent,
    UserBanModalComponent,
    UserModerationDropdownComponent,
    TopMenuDropdownComponent,
    UserNotificationsComponent,
    ConfirmComponent,

    GlobalIconComponent,
    ImageUploadComponent
  ],

  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,

    NgbDropdownModule,
    NgbModalModule,
    NgbPopoverModule,
    NgbTabsetModule,
    NgbTooltipModule,

    PrimeSharedModule,
    InputMaskModule,
    KeyFilterModule,
    BytesPipe,
    KeysPipe,

    LoaderComponent,
    SmallLoaderComponent,

    VideoThumbnailComponent,
    VideoMiniatureComponent,
    VideoPlaylistMiniatureComponent,
    VideoAddToPlaylistComponent,

    FeedComponent,

    ButtonComponent,
    DeleteButtonComponent,
    EditButtonComponent,

    ActionDropdownComponent,
    MarkdownTextareaComponent,
    InfiniteScrollerDirective,
    TextareaAutoResizeDirective,
    HelpComponent,

    ReactiveFileComponent,
    PeertubeCheckboxComponent,
    TimestampInputComponent,

    SubscribeButtonComponent,
    RemoteSubscribeComponent,
    InstanceFeaturesTableComponent,
    UserBanModalComponent,
    UserModerationDropdownComponent,
    TopMenuDropdownComponent,
    UserNotificationsComponent,
    ConfirmComponent,

    GlobalIconComponent,
    ImageUploadComponent,

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
    VideoOwnershipService,
    UserService,
    VideoService,
    AccountService,
    VideoChannelService,
    VideoPlaylistService,
    VideoCaptionService,
    VideoImportService,
    UserSubscriptionService,

    FormValidatorService,
    CustomConfigValidatorsService,
    LoginValidatorsService,
    ResetPasswordValidatorsService,
    UserValidatorsService,
    VideoPlaylistValidatorsService,
    VideoAbuseValidatorsService,
    VideoChannelValidatorsService,
    VideoCommentValidatorsService,
    VideoValidatorsService,
    VideoCaptionsValidatorsService,
    VideoBlacklistValidatorsService,
    OverviewService,
    VideoChangeOwnershipValidatorsService,
    VideoAcceptOwnershipValidatorsService,
    InstanceValidatorsService,
    BlocklistService,
    UserHistoryService,
    InstanceService,

    MarkdownService,
    LinkifierService,
    HtmlRendererService,

    I18nPrimengCalendarService,
    ScreenService,

    UserNotificationService,

    I18n
  ]
})
export class SharedModule { }
