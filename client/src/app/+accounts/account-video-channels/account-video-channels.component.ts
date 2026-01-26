import { Component, inject, OnDestroy, OnInit } from '@angular/core'
import { RouterLink } from '@angular/router'
import { ComponentPagination, hasMoreItems, MarkdownService, User, UserService } from '@app/core'
import { SimpleMemoize } from '@app/helpers'
import { NSFWPolicyType, VideoSortField } from '@peertube/peertube-models'
import { from, Subject, Subscription } from 'rxjs'
import { concatMap, map, switchMap, tap } from 'rxjs/operators'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { InfiniteScrollerDirective } from '../../shared/shared-main/common/infinite-scroller.directive'
import { SubscribeButtonComponent } from '../../shared/shared-user-subscription/subscribe-button.component'
import { MiniatureDisplayOptions, VideoMiniatureComponent } from '../../shared/shared-video-miniature/video-miniature.component'
import { Account } from '@app/shared/shared-main/account/account.model'
import { AccountService } from '@app/shared/shared-main/account/account.service'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoService } from '@app/shared/shared-main/video/video.service'

@Component({
  selector: 'my-account-video-channels',
  templateUrl: './account-video-channels.component.html',
  styleUrls: [ './account-video-channels.component.scss' ],
  imports: [ InfiniteScrollerDirective, ActorAvatarComponent, RouterLink, SubscribeButtonComponent, VideoMiniatureComponent ]
})
export class AccountVideoChannelsComponent implements OnInit, OnDestroy {
  private accountService = inject(AccountService)
  private videoChannelService = inject(VideoChannelService)
  private videoService = inject(VideoService)
  private markdown = inject(MarkdownService)
  private userService = inject(UserService)

  account: Account
  videoChannels: VideoChannel[] = []

  videos: { [id: number]: { total: number, videos: Video[] } } = {}

  channelsDescriptionHTML: { [id: number]: string } = {}

  channelPagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 2,
    totalItems: null
  }

  videosPagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 5,
    totalItems: null
  }
  videosSort: VideoSortField = '-publishedAt'

  onChannelDataSubject = new Subject<any>()

  userMiniature: User
  nsfwPolicy: NSFWPolicyType
  miniatureDisplayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: false,
    avatar: false,
    privacyLabel: false
  }

  private accountSub: Subscription

  ngOnInit () {
    // Parent get the account for us
    this.accountSub = this.accountService.accountLoaded
      .subscribe(account => {
        this.account = account
        this.videoChannels = []

        this.loadMoreChannels()
      })

    this.userService.getAnonymousOrLoggedUser()
      .subscribe(user => {
        this.userMiniature = user

        this.nsfwPolicy = user.nsfwPolicy
      })
  }

  ngOnDestroy () {
    if (this.accountSub) this.accountSub.unsubscribe()
  }

  loadMoreChannels () {
    const options = {
      account: this.account,
      componentPagination: this.channelPagination,
      sort: '-updatedAt'
    }

    this.videoChannelService.listAccountChannels(options)
      .pipe(
        tap(res => {
          this.channelPagination.totalItems = res.total
        }),
        switchMap(res => from(res.data)),
        concatMap(videoChannel => {
          const options = {
            videoChannel,
            videoPagination: this.videosPagination,
            sort: this.videosSort,
            nsfw: this.videoService.nsfwPolicyToParam(this.nsfwPolicy)
          }

          return this.videoService.listChannelVideos(options)
            .pipe(map(data => ({ videoChannel, videos: data.data, total: data.total })))
        })
      )
      .subscribe(async ({ videoChannel, videos, total }) => {
        this.channelsDescriptionHTML[videoChannel.id] = await this.markdown.textMarkdownToHTML({
          markdown: videoChannel.description,
          withEmoji: true,
          withHtml: true
        })

        this.videoChannels.push(videoChannel)

        this.videos[videoChannel.id] = { videos, total }

        this.onChannelDataSubject.next([ videoChannel ])
      })
  }

  getVideosOf (videoChannel: VideoChannel) {
    const obj = this.videos[videoChannel.id]
    if (!obj) return []

    return obj.videos
  }

  getTotalVideosOf (videoChannel: VideoChannel) {
    const obj = this.videos[videoChannel.id]
    if (!obj) return undefined

    return obj.total
  }

  getChannelDescription (videoChannel: VideoChannel) {
    return this.channelsDescriptionHTML[videoChannel.id]
  }

  onNearOfBottom () {
    if (!hasMoreItems(this.channelPagination)) return

    this.channelPagination.currentPage += 1

    this.loadMoreChannels()
  }

  @SimpleMemoize()
  getVideoChannelLink (videoChannel: VideoChannel) {
    return [ '/c', videoChannel.nameWithHost ]
  }
}
