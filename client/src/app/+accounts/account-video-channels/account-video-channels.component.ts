import { from, Subject, Subscription } from 'rxjs'
import { concatMap, map, switchMap, tap } from 'rxjs/operators'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { ComponentPagination, hasMoreItems, MarkdownService, ScreenService, User, UserService } from '@app/core'
import { Account, AccountService, Video, VideoChannel, VideoChannelService, VideoService } from '@app/shared/shared-main'
import { NSFWPolicyType, VideoSortField } from '@shared/models'
import { MiniatureDisplayOptions } from '@app/shared/shared-video-miniature'

@Component({
  selector: 'my-account-video-channels',
  templateUrl: './account-video-channels.component.html',
  styleUrls: [ './account-video-channels.component.scss' ]
})
export class AccountVideoChannelsComponent implements OnInit, OnDestroy {
  account: Account
  videoChannels: VideoChannel[] = []

  videos: { [id: number]: { total: number, videos: Video[] } } = {}

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

  private accountSub: Subscription

  constructor (
    private accountService: AccountService,
    private videoChannelService: VideoChannelService,
    private videoService: VideoService,
    private markdown: MarkdownService,
    private userService: UserService
  ) { }

  ngOnInit () {
    // Parent get the account for us
    this.accountSub = this.accountService.accountLoaded
        .subscribe(account => {
          this.account = account

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

    this.videoChannelService.listAccountVideoChannels(options)
      .pipe(
        tap(res => this.channelPagination.totalItems = res.total),
        switchMap(res => from(res.data)),
        concatMap(videoChannel => {
          const options = {
            videoChannel,
            videoPagination: this.videosPagination,
            sort: this.videosSort,
            nsfwPolicy: this.nsfwPolicy
          }

          return this.videoService.getVideoChannelVideos(options)
            .pipe(map(data => ({ videoChannel, videos: data.data, total: data.total })))
        })
      )
      .subscribe(async ({ videoChannel, videos, total }) => {
        this.channelsDescriptionHTML[videoChannel.id] = await this.markdown.textMarkdownToHTML(videoChannel.description)

        this.videoChannels.push(videoChannel)

        this.videos[videoChannel.id] = { videos, total }

        this.onChannelDataSubject.next([ videoChannel ])
      })
  }

  getVideosOf (videoChannel: VideoChannel) {
    const obj = this.videos[ videoChannel.id ]
    if (!obj) return []

    return obj.videos
  }

  getTotalVideosOf (videoChannel: VideoChannel) {
    const obj = this.videos[ videoChannel.id ]
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

  getVideoChannelLink (videoChannel: VideoChannel) {
    return [ '/c', videoChannel.nameWithHost ]
  }
}
