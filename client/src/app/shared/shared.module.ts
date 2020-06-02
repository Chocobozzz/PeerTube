import { BytesPipe, KeysPipe, NgPipesModule } from 'ngx-pipes'
import { SharedModule as PrimeSharedModule } from 'primeng/api'
import { InputMaskModule } from 'primeng/inputmask'
import { InputSwitchModule } from 'primeng/inputswitch'
import { MultiSelectModule } from 'primeng/multiselect'
import { ClipboardModule } from '@angular/cdk/clipboard'
import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'
import { BatchDomainsValidatorsService } from '@app/+admin/config/shared/batch-domains-validators.service'
import { MyAccountInterfaceSettingsComponent } from '@app/+my-account/my-account-settings/my-account-interface'
import { MyAccountVideoSettingsComponent } from '@app/+my-account/my-account-settings/my-account-video-settings'
import { ActorAvatarInfoComponent } from '@app/+my-account/shared/actor-avatar-info.component'
import { AccountService } from '@app/shared/account/account.service'
import { FromNowPipe } from '@app/shared/angular/from-now.pipe'
import { HighlightPipe } from '@app/shared/angular/highlight.pipe'
import { NumberFormatterPipe } from '@app/shared/angular/number-formatter.pipe'
import { ObjectLengthPipe } from '@app/shared/angular/object-length.pipe'
import { PeerTubeTemplateDirective } from '@app/shared/angular/peertube-template.directive'
import { VideoDurationPipe } from '@app/shared/angular/video-duration-formatter.pipe'
import { BlocklistService } from '@app/shared/blocklist'
import { ActionDropdownComponent } from '@app/shared/buttons/action-dropdown.component'
import { AvatarComponent } from '@app/shared/channel/avatar.component'
import { ConfirmComponent } from '@app/shared/confirm/confirm.component'
import { DateToggleComponent } from '@app/shared/date/date-toggle.component'
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
  VideoBlockValidatorsService,
  VideoChangeOwnershipValidatorsService,
  VideoChannelValidatorsService,
  VideoCommentValidatorsService,
  VideoPlaylistValidatorsService,
  VideoValidatorsService
} from '@app/shared/forms'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { VideoCaptionsValidatorsService } from '@app/shared/forms/form-validators/video-captions-validators.service'
import { InputReadonlyCopyComponent } from '@app/shared/forms/input-readonly-copy.component'
import { MarkdownTextareaComponent } from '@app/shared/forms/markdown-textarea.component'
import { PeertubeCheckboxComponent } from '@app/shared/forms/peertube-checkbox.component'
import { TimestampInputComponent } from '@app/shared/forms/timestamp-input.component'
import { I18nPrimengCalendarService } from '@app/shared/i18n/i18n-primeng-calendar'
import { GlobalIconComponent } from '@app/shared/images/global-icon.component'
import { PreviewUploadComponent } from '@app/shared/images/preview-upload.component'
import { FeatureBooleanComponent } from '@app/shared/instance/feature-boolean.component'
import { FollowService } from '@app/shared/instance/follow.service'
import { InstanceFeaturesTableComponent } from '@app/shared/instance/instance-features-table.component'
import { InstanceStatisticsComponent } from '@app/shared/instance/instance-statistics.component'
import { InstanceService } from '@app/shared/instance/instance.service'
import { TopMenuDropdownComponent } from '@app/shared/menu/top-menu-dropdown.component'
import { HelpComponent } from '@app/shared/misc/help.component'
import { ListOverflowComponent } from '@app/shared/misc/list-overflow.component'
import { ScreenService } from '@app/shared/misc/screen.service'
import { SmallLoaderComponent } from '@app/shared/misc/small-loader.component'
import { LocalStorageService, SessionStorageService } from '@app/shared/misc/storage.service'
import { UserBanModalComponent } from '@app/shared/moderation'
import { UserModerationDropdownComponent } from '@app/shared/moderation/user-moderation-dropdown.component'
import { OverviewService } from '@app/shared/overview'
import { HtmlRendererService, LinkifierService, MarkdownService } from '@app/shared/renderer'
import { RemoteSubscribeComponent, SubscribeButtonComponent, UserSubscriptionService } from '@app/shared/user-subscription'
import { UserHistoryService } from '@app/shared/users/user-history.service'
import { UserNotificationService } from '@app/shared/users/user-notification.service'
import { UserNotificationsComponent } from '@app/shared/users/user-notifications.component'
import { VideoCaptionService } from '@app/shared/video-caption'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { VideoImportService } from '@app/shared/video-import/video-import.service'
import { VideoAddToPlaylistComponent } from '@app/shared/video-playlist/video-add-to-playlist.component'
import { VideoPlaylistElementMiniatureComponent } from '@app/shared/video-playlist/video-playlist-element-miniature.component'
import { VideoPlaylistMiniatureComponent } from '@app/shared/video-playlist/video-playlist-miniature.component'
import { VideoPlaylistService } from '@app/shared/video-playlist/video-playlist.service'
import { InfiniteScrollerDirective } from '@app/shared/video/infinite-scroller.directive'
import { VideoBlockComponent } from '@app/shared/video/modals/video-block.component'
import { VideoDownloadComponent } from '@app/shared/video/modals/video-download.component'
import { VideoReportComponent } from '@app/shared/video/modals/video-report.component'
import { RedundancyService } from '@app/shared/video/redundancy.service'
import { VideoActionsDropdownComponent } from '@app/shared/video/video-actions-dropdown.component'
import { VideosSelectionComponent } from '@app/shared/video/videos-selection.component'
import {
  NgbCollapseModule,
  NgbDropdownModule,
  NgbModalModule,
  NgbNavModule,
  NgbPopoverModule,
  NgbTooltipModule
} from '@ng-bootstrap/ng-bootstrap'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { AUTH_INTERCEPTOR_PROVIDER } from './auth'
import { BulkService } from './bulk/bulk.service'
import { ButtonComponent } from './buttons/button.component'
import { DeleteButtonComponent } from './buttons/delete-button.component'
import { EditButtonComponent } from './buttons/edit-button.component'
import { LoaderComponent } from './misc/loader.component'
import { RestExtractor, RestService } from './rest'
import { UserService } from './users'
import { VideoAbuseService } from './video-abuse'
import { VideoBlockService } from './video-block'
import { VideoOwnershipService } from './video-ownership'
import { FeedComponent } from './video/feed.component'
import { VideoMiniatureComponent } from './video/video-miniature.component'
import { VideoThumbnailComponent } from './video/video-thumbnail.component'
import { VideoService } from './video/video.service'

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
    NgbNavModule,
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
    VideoBlockComponent,

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
    MyAccountInterfaceSettingsComponent,
    ActorAvatarInfoComponent
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
    NgbNavModule,
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
    VideoBlockComponent,

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
    MyAccountInterfaceSettingsComponent,
    ActorAvatarInfoComponent
  ],

  providers: [
    AUTH_INTERCEPTOR_PROVIDER,
    RestExtractor,
    RestService,
    VideoAbuseService,
    VideoBlockService,
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
    BatchDomainsValidatorsService,
    VideoPlaylistValidatorsService,
    VideoAbuseValidatorsService,
    VideoChannelValidatorsService,
    VideoCommentValidatorsService,
    VideoValidatorsService,
    VideoCaptionsValidatorsService,
    VideoBlockValidatorsService,
    OverviewService,
    VideoChangeOwnershipValidatorsService,
    VideoAcceptOwnershipValidatorsService,
    InstanceValidatorsService,
    BlocklistService,
    UserHistoryService,
    InstanceService,
    BulkService,

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
