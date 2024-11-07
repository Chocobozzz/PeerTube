import { from, Subject } from 'rxjs'
import { concatMap, map, switchMap, tap } from 'rxjs/operators'
import { Component, OnInit } from '@angular/core'
import { ComponentPagination, hasMoreItems, MarkdownService, User, UserService } from '@app/core'
import { SimpleMemoize } from '@app/helpers'
import { NSFWPolicyType, VideoSortField } from '@peertube/peertube-models'
import { MiniatureDisplayOptions, VideoMiniatureComponent } from '../../shared/shared-video-miniature/video-miniature.component'
import { SubscribeButtonComponent } from '../../shared/shared-user-subscription/subscribe-button.component'
import { RouterLink } from '@angular/router'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { InfiniteScrollerComponent } from '../../shared/shared-main/common/infinite-scroller.component'
import { NgIf, NgFor } from '@angular/common'
import { AccountService } from '@app/shared/shared-main/account/account.service'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { Account } from '@app/shared/shared-main/account/account.model'
import { Video } from '@app/shared/shared-main/video/video.model'

@Component({
  selector: 'my-account-video-channels',
  templateUrl: './account-video-channels.component.html',
  styleUrls: [ './account-video-channels.component.scss' ],
  standalone: true,
  imports: [ NgIf, InfiniteScrollerComponent, NgFor, ActorAvatarComponent, RouterLink, SubscribeButtonComponent, VideoMiniatureComponent ]
})
export class AccountVideoChannelsComponent implements OnInit {
  account: Account
  videoChannels: VideoChannel[] = []

  videos: { [id: number]: { total: number, videos: Video[] } } = {}

  hasMoreVideoChannels = true
  isLoading = true

  channelsDescriptionHTML: { [ id: number ]: string } = {}

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
    privacyLabel: false,
    privacyText: false,
    state: false,
    blacklistInfo: false
  }

  constructor (
    private accountService: AccountService,
    private videoChannelService: VideoChannelService,
    private videoService: VideoService,
    private markdown: MarkdownService,
    private userService: UserService
  ) { }

  ngOnInit () {
    this.userService.getAnonymousOrLoggedUser()
      .subscribe(user => {
        this.userMiniature = user

        this.nsfwPolicy = user.nsfwPolicy
      })
  }

  loadMoreChannels (reset = false) {
    let hasDoneReset = false
    this.isLoading = true

    // Parent get the account for us
    this.accountService.accountLoaded
      .pipe(
        tap(account => {
          this.account = account
        }),
        switchMap(() => this.videoChannelService.listAccountVideoChannels({
          account: this.account,
          componentPagination: this.channelPagination,
          sort: '-updatedAt'
        }))
      )
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

          return this.videoService.getVideoChannelVideos(options)
            .pipe(map(data => ({ videoChannel, videos: data.data, total: data.total })))
        })
      )
      .subscribe(async ({ videoChannel, videos, total }) => {
        this.isLoading = false
        this.channelsDescriptionHTML[videoChannel.id] = await this.markdown.textMarkdownToHTML({
          markdown: videoChannel.description,
          withEmoji: true,
          withHtml: true
        })

        if (reset && !hasDoneReset) {
          hasDoneReset = true
          this.videoChannels = []
        }

        this.videoChannels.push(videoChannel)
        this.hasMoreVideoChannels = (this.channelPagination.currentPage * this.channelPagination.itemsPerPage) <
          this.channelPagination.totalItems

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

  onPageChange () {
    this.loadMoreChannels(true)
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
