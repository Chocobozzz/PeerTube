import { map, switchMap } from 'rxjs/operators'
import { Component, Input, OnInit } from '@angular/core'
import { MarkdownService, UserService } from '@app/core'
import { Video, VideoSortField } from '@shared/models/videos'
import { VideoChannel, VideoChannelService, VideoService } from '../../shared-main'

/*
 * Markup component that creates a channel miniature only
*/

@Component({
  selector: 'my-channel-miniature-markup',
  templateUrl: 'channel-miniature-markup.component.html',
  styleUrls: [ 'channel-miniature-markup.component.scss' ]
})
export class ChannelMiniatureMarkupComponent implements OnInit {
  @Input() name: string
  @Input() displayLatestVideo: boolean
  @Input() displayDescription: boolean

  channel: VideoChannel
  descriptionHTML: string
  totalVideos: number
  video: Video

  constructor (
    private markdown: MarkdownService,
    private channelService: VideoChannelService,
    private videoService: VideoService,
    private userService: UserService
  ) { }

  ngOnInit () {
    this.channelService.getVideoChannel(this.name)
      .subscribe(async channel => {
        this.channel = channel

        this.descriptionHTML = await this.markdown.textMarkdownToHTML(channel.description)

        this.loadVideos()
      })
  }

  getVideoChannelLink () {
    return [ '/c', this.channel.nameWithHost ]
  }

  private loadVideos () {
    const videoOptions = {
      videoChannel: this.channel,
      videoPagination: {
        currentPage: 1,
        itemsPerPage: 1
      },
      sort: '-publishedAt' as VideoSortField,
      count: 1
    }

    this.userService.getAnonymousOrLoggedUser()
      .pipe(
        map(user => user.nsfwPolicy),
        switchMap(nsfwPolicy => this.videoService.getVideoChannelVideos({ ...videoOptions, nsfwPolicy }))
      )
      .subscribe(({ total, data }) => {
        this.totalVideos = total
        this.video = data[0]
      })
  }
}
