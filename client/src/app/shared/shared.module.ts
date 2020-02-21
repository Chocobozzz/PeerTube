import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'
import { MarkdownTextareaComponent } from '@app/shared/forms/markdown-textarea.component'
import { HelpComponent } from '@app/shared/misc/help.component'
import { ListOverflowComponent } from '@app/shared/misc/list-overflow.component'
import { InfiniteScrollerDirective } from '@app/shared/video/infinite-scroller.directive'
import { BytesPipe, KeysPipe, NgPipesModule } from 'ngx-pipes'
import { SharedModule as PrimeSharedModule } from 'primeng/api'
import { AUTH_INTERCEPTOR_PROVIDER } from './auth'
import { ButtonComponent } from './buttons/button.component'
import { DeleteButtonComponent } from './buttons/delete-button.component'
import { EditButtonComponent } from './buttons/edit-button.component'
import { LoaderComponent } from './misc/loader.component'
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
import { LocalStorageService, SessionStorageService } from '@app/shared/misc/storage.service'
import { VideoCaptionsValidatorsService } from '@app/shared/forms/form-validators/video-captions-validators.service'
import { VideoCaptionService } from '@app/shared/video-caption'
import { PeertubeCheckboxComponent } from '@app/shared/forms/peertube-checkbox.component'
import { VideoImportService } from '@app/shared/video-import/video-import.service'
import { ActionDropdownComponent } from '@app/shared/buttons/action-dropdown.component'
import {
  NgbCollapseModule,
  NgbDropdownModule,
  NgbModalModule,
  NgbPopoverModule,
  NgbTabsetModule,
  NgbTooltipModule
} from '@ng-bootstrap/ng-bootstrap'
import { RemoteSubscribeComponent, SubscribeButtonComponent, UserSubscriptionService } from '@app/shared/user-subscription'
import { InstanceFeaturesTableComponent } from '@app/shared/instance/instance-features-table.component'
import { InstanceStatisticsComponent } from '@app/shared/instance/instance-statistics.component'
import { OverviewService } from '@app/shared/overview'
import { UserBanModalComponent } from '@app/shared/moderation'
import { UserModerationDropdownComponent } from '@app/shared/moderation/user-moderation-dropdown.component'
import { BlocklistService } from '@app/shared/blocklist'
import { AvatarComponent } from '@app/shared/channel/avatar.component'
import { TopMenuDropdownComponent } from '@app/shared/menu/top-menu-dropdown.component'
import { UserHistoryService } from '@app/shared/users/user-history.service'
import { UserNotificationService } from '@app/shared/users/user-notification.service'
import { UserNotificationsComponent } from '@app/shared/users/user-notifications.component'
import { InstanceService } from '@app/shared/instance/instance.service'
import { HtmlRendererService, LinkifierService, MarkdownService } from '@app/shared/renderer'
import { ConfirmComponent } from '@app/shared/confirm/confirm.component'
import { DateToggleComponent } from '@app/shared/date/date-toggle.component'
import { SmallLoaderComponent } from '@app/shared/misc/small-loader.component'
import { VideoPlaylistService } from '@app/shared/video-playlist/video-playlist.service'
import { PreviewUploadComponent } from '@app/shared/images/preview-upload.component'
import { GlobalIconComponent } from '@app/shared/images/global-icon.component'
import { VideoPlaylistMiniatureComponent } from '@app/shared/video-playlist/video-playlist-miniature.component'
import { VideoAddToPlaylistComponent } from '@app/shared/video-playlist/video-add-to-playlist.component'
import { TimestampInputComponent } from '@app/shared/forms/timestamp-input.component'
import { VideoPlaylistElementMiniatureComponent } from '@app/shared/video-playlist/video-playlist-element-miniature.component'
import { VideosSelectionComponent } from '@app/shared/video/videos-selection.component'
import { NumberFormatterPipe } from '@app/shared/angular/number-formatter.pipe'
import { VideoDurationPipe } from '@app/shared/angular/video-duration-formatter.pipe'
import { ObjectLengthPipe } from '@app/shared/angular/object-length.pipe'
import { FromNowPipe } from '@app/shared/angular/from-now.pipe'
import { HighlightPipe } from '@app/shared/angular/highlight.pipe'
import { PeerTubeTemplateDirective } from '@app/shared/angular/peertube-template.directive'
import { VideoActionsDropdownComponent } from '@app/shared/video/video-actions-dropdown.component'
import { VideoBlacklistComponent } from '@app/shared/video/modals/video-blacklist.component'
import { VideoDownloadComponent } from '@app/shared/video/modals/video-download.component'
import { VideoReportComponent } from '@app/shared/video/modals/video-report.component'
import { FollowService } from '@app/shared/instance/follow.service'
import { MultiSelectModule } from 'primeng/multiselect'
import { FeatureBooleanComponent } from '@app/shared/instance/feature-boolean.component'
import { InputReadonlyCopyComponent } from '@app/shared/forms/input-readonly-copy.component'
import { RedundancyService } from '@app/shared/video/redundancy.service'
import { ClipboardModule } from '@angular/cdk/clipboard'
import { InputSwitchModule } from 'primeng/inputswitch'

import { MyAccountVideoSettingsComponent } from '@app/+my-account/my-account-settings/my-account-video-settings'
import { MyAccountInterfaceSettingsComponent } from '@app/+my-account/my-account-settings/my-account-interface'

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
    NgbCollapseModule,

    ClipboardModule,

    PrimeSharedModule,
    InputMaskModule,
    NgPipesModule,
    MultiSelectModule,
    InputSwitchModule
  ],

  declarations: [
    LoaderComponent,
    SmallLoaderComponent,

    VideoThumbnailComponent,
    VideoMiniatureComponent,
    VideoPlaylistMiniatureComponent,
    VideoAddToPlaylistComponent,
    VideoPlaylistElementMiniatureComponent,
    VideosSelectionComponent,
    VideoActionsDropdownComponent,

    VideoDownloadComponent,
    VideoReportComponent,
    VideoBlacklistComponent,

    FeedComponent,

    ButtonComponent,
    DeleteButtonComponent,
    EditButtonComponent,

    NumberFormatterPipe,
    ObjectLengthPipe,
    FromNowPipe,
    HighlightPipe,
    PeerTubeTemplateDirective,
    VideoDurationPipe,

    ActionDropdownComponent,
    MarkdownTextareaComponent,
    InfiniteScrollerDirective,
    TextareaAutoResizeDirective,
    HelpComponent,
    ListOverflowComponent,

    ReactiveFileComponent,
    PeertubeCheckboxComponent,
    TimestampInputComponent,
    InputReadonlyCopyComponent,

    AvatarComponent,
    SubscribeButtonComponent,
    RemoteSubscribeComponent,
    InstanceFeaturesTableComponent,
    InstanceStatisticsComponent,
    FeatureBooleanComponent,
    UserBanModalComponent,
    UserModerationDropdownComponent,
    TopMenuDropdownComponent,
    UserNotificationsComponent,
    ConfirmComponent,
    DateToggleComponent,

    GlobalIconComponent,
    PreviewUploadComponent,

    MyAccountVideoSettingsComponent,
    MyAccountInterfaceSettingsComponent
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
    NgbCollapseModule,

    ClipboardModule,

    PrimeSharedModule,
    InputMaskModule,
    BytesPipe,
    KeysPipe,
    MultiSelectModule,

    LoaderComponent,
    SmallLoaderComponent,

    VideoThumbnailComponent,
    VideoMiniatureComponent,
    VideoPlaylistMiniatureComponent,
    VideoAddToPlaylistComponent,
    VideoPlaylistElementMiniatureComponent,
    VideosSelectionComponent,
    VideoActionsDropdownComponent,

    VideoDownloadComponent,
    VideoReportComponent,
    VideoBlacklistComponent,

    FeedComponent,

    ButtonComponent,
    DeleteButtonComponent,
    EditButtonComponent,

    ActionDropdownComponent,
    MarkdownTextareaComponent,
    InfiniteScrollerDirective,
    TextareaAutoResizeDirective,
    HelpComponent,
    ListOverflowComponent,
    InputReadonlyCopyComponent,

    ReactiveFileComponent,
    PeertubeCheckboxComponent,
    TimestampInputComponent,

    AvatarComponent,
    SubscribeButtonComponent,
    RemoteSubscribeComponent,
    InstanceFeaturesTableComponent,
    InstanceStatisticsComponent,
    UserBanModalComponent,
    UserModerationDropdownComponent,
    TopMenuDropdownComponent,
    UserNotificationsComponent,
    ConfirmComponent,
    DateToggleComponent,

    GlobalIconComponent,
    PreviewUploadComponent,

    NumberFormatterPipe,
    ObjectLengthPipe,
    FromNowPipe,
    HighlightPipe,
    PeerTubeTemplateDirective,
    VideoDurationPipe,

    MyAccountVideoSettingsComponent,
    MyAccountInterfaceSettingsComponent
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
    LocalStorageService, SessionStorageService,

    UserNotificationService,

    FollowService,
    RedundancyService,

    I18n
  ]
})
export class SharedModule { }
