import { SharedModule as PrimeSharedModule } from 'primeng/api'
import { ClipboardModule } from '@angular/cdk/clipboard'
import { CommonModule, DatePipe } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'
import {
  NgbCollapseModule,
  NgbDropdownModule,
  NgbModalModule,
  NgbNavModule,
  NgbPopoverModule,
  NgbTooltipModule
} from '@ng-bootstrap/ng-bootstrap'
import { LoadingBarModule } from '@ngx-loading-bar/core'
import { LoadingBarHttpClientModule } from '@ngx-loading-bar/http-client'
import { SharedGlobalIconModule } from '../shared-icons'
import { AccountService, SignupLabelComponent } from './account'
import {
  AutoColspanDirective,
  AutofocusDirective,
  BytesPipe,
  DeferLoadingDirective,
  DurationFormatterPipe,
  FromNowPipe,
  InfiniteScrollerDirective,
  LinkComponent,
  LoginLinkComponent,
  NumberFormatterPipe,
  PeerTubeTemplateDirective
} from './angular'
import { AUTH_INTERCEPTOR_PROVIDER } from './auth'
import { ActionDropdownComponent, ButtonComponent, DeleteButtonComponent, EditButtonComponent } from './buttons'
import { CustomPageService } from './custom-page'
import { DateToggleComponent } from './date'
import { FeedComponent } from './feeds'
import { LoaderComponent } from './loaders'
import {
  ChannelsSetupMessageComponent,
  HelpComponent,
  ListOverflowComponent,
  SimpleSearchInputComponent,
  TopMenuDropdownComponent
} from './misc'
import { PluginPlaceholderComponent, PluginSelectorDirective } from './plugins'
import { ActorRedirectGuard } from './router'
import { UserHistoryService, UserNotificationsComponent, UserNotificationService, UserQuotaComponent } from './users'
import {
  EmbedComponent,
  RedundancyService,
  VideoFileTokenService,
  VideoImportService,
  VideoOwnershipService,
  VideoPasswordService,
  VideoResolver,
  VideoService
} from './video'
import { VideoCaptionService } from './video-caption'
import { VideoChannelService } from './video-channel'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,

    LoadingBarHttpClientModule,
    LoadingBarModule,

    NgbDropdownModule,
    NgbModalModule,
    NgbPopoverModule,
    NgbNavModule,
    NgbTooltipModule,
    NgbCollapseModule,

    ClipboardModule,

    PrimeSharedModule,

    SharedGlobalIconModule
  ],

  declarations: [
    FromNowPipe,
    NumberFormatterPipe,
    BytesPipe,
    DurationFormatterPipe,
    AutofocusDirective,
    DeferLoadingDirective,
    AutoColspanDirective,

    InfiniteScrollerDirective,
    PeerTubeTemplateDirective,
    LinkComponent,
    LoginLinkComponent,

    ActionDropdownComponent,
    ButtonComponent,
    DeleteButtonComponent,
    EditButtonComponent,

    DateToggleComponent,

    FeedComponent,

    LoaderComponent,

    ChannelsSetupMessageComponent,
    HelpComponent,
    ListOverflowComponent,
    TopMenuDropdownComponent,
    SimpleSearchInputComponent,

    UserQuotaComponent,
    UserNotificationsComponent,

    SignupLabelComponent,

    EmbedComponent,

    PluginPlaceholderComponent,
    PluginSelectorDirective
  ],

  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,

    LoadingBarHttpClientModule,
    LoadingBarModule,

    NgbDropdownModule,
    NgbModalModule,
    NgbPopoverModule,
    NgbNavModule,
    NgbTooltipModule,
    NgbCollapseModule,

    ClipboardModule,

    PrimeSharedModule,

    FromNowPipe,
    BytesPipe,
    NumberFormatterPipe,
    DurationFormatterPipe,
    AutofocusDirective,
    DeferLoadingDirective,
    AutoColspanDirective,

    InfiniteScrollerDirective,
    PeerTubeTemplateDirective,
    LinkComponent,
    LoginLinkComponent,

    ActionDropdownComponent,
    ButtonComponent,
    DeleteButtonComponent,
    EditButtonComponent,

    DateToggleComponent,

    FeedComponent,

    LoaderComponent,

    ChannelsSetupMessageComponent,
    HelpComponent,
    ListOverflowComponent,
    TopMenuDropdownComponent,
    SimpleSearchInputComponent,

    UserQuotaComponent,
    UserNotificationsComponent,

    SignupLabelComponent,

    EmbedComponent,

    PluginPlaceholderComponent,
    PluginSelectorDirective
  ],

  providers: [
    DatePipe,

    FromNowPipe,

    AUTH_INTERCEPTOR_PROVIDER,

    AccountService,

    UserHistoryService,
    UserNotificationService,

    RedundancyService,
    VideoImportService,
    VideoOwnershipService,
    VideoService,
    VideoFileTokenService,
    VideoResolver,

    VideoCaptionService,

    VideoChannelService,

    VideoPasswordService,

    CustomPageService,

    ActorRedirectGuard
  ]
})
export class SharedMainModule { }
