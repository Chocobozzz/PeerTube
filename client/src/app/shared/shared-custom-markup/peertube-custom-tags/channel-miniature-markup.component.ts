import { from } from 'rxjs'
import { finalize, map, switchMap, tap } from 'rxjs/operators'
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { MarkdownService, Notifier, UserService } from '@app/core'
import { Video, VideoSortField } from '@shared/models/videos'
import { VideoChannel, VideoChannelService, VideoService } from '../../shared-main'
import { CustomMarkupComponent } from './shared'

/*
 * Markup component that creates a channel miniature only
*/

@Component({
  selector: 'my-channel-miniature-markup',
  templateUrl: 'channel-miniature-markup.component.html',
  styleUrls: [ 'channel-miniature-markup.component.scss' ]
})
export class ChannelMiniatureMarkupComponent implements CustomMarkupComponent, OnInit {
  @Input() name: string
  @Input() displayLatestVideo: boolean
  @Input() displayDescription: boolean

  @Output() loaded = new EventEmitter<boolean>()

  channel: VideoChannel
  descriptionHTML: string
  totalVideos: number
  video: Video

  constructor (
    private markdown: MarkdownService,
    private channelService: VideoChannelService,
    private videoService: VideoService,
    private userService: UserService,
    private notifier: Notifier
  ) { }

  ngOnInit () {
    this.channelService.getVideoChannel(this.name)
      .pipe(
        tap(channel => this.channel = channel),
        switchMap(() => from(this.markdown.textMarkdownToHTML(this.channel.description))),
        tap(html => this.descriptionHTML = html),
        switchMap(() => this.loadVideosObservable()),
        finalize(() => this.loaded.emit(true))
      ).subscribe(
        ({ total, data }) => {
          this.totalVideos = total
          this.video = data[0]
        },

        err => this.notifier.error('Error in channel miniature component: ' + err.message)
      )
  }

  getVideoChannelLink () {
    return [ '/c', this.channel.nameWithHost ]
  }

  private loadVideosObservable () {
    const videoOptions = {
      videoChannel: this.channel,
      videoPagination: {
        currentPage: 1,
        itemsPerPage: 1
      },
      sort: '-publishedAt' as VideoSortField,
      count: 1
    }

    return this.userService.getAnonymousOrLoggedUser()
      .pipe(
        map(user => user.nsfwPolicy),
        switchMap(nsfwPolicy => this.videoService.getVideoChannelVideos({ ...videoOptions, nsfwPolicy }))
      )
  }
}
