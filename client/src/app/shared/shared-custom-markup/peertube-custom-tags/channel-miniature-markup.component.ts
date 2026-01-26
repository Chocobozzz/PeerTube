import { from } from 'rxjs'
import { finalize, map, switchMap, tap } from 'rxjs/operators'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, input, output } from '@angular/core'
import { MarkdownService, Notifier, UserService } from '@app/core'
import { VideoSortField } from '@peertube/peertube-models'
import { CustomMarkupComponent } from './shared'
import { VideoMiniatureMarkupComponent } from './video-miniature-markup.component'
import { RouterLink } from '@angular/router'
import { ActorAvatarComponent } from '../../shared-actor-image/actor-avatar.component'

import { VideoService } from '@app/shared/shared-main/video/video.service'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { Video } from '@app/shared/shared-main/video/video.model'
import { FindInBulkService } from '@app/shared/shared-search/find-in-bulk.service'

/*
 * Markup component that creates a channel miniature only
 */

@Component({
  selector: 'my-channel-miniature-markup',
  templateUrl: 'channel-miniature-markup.component.html',
  styleUrls: [ 'channel-miniature-markup.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ ActorAvatarComponent, RouterLink, VideoMiniatureMarkupComponent ]
})
export class ChannelMiniatureMarkupComponent implements CustomMarkupComponent, OnInit {
  private markdown = inject(MarkdownService)
  private findInBulk = inject(FindInBulkService)
  private videoService = inject(VideoService)
  private userService = inject(UserService)
  private notifier = inject(Notifier)
  private cd = inject(ChangeDetectorRef)

  readonly name = input<string>(undefined)
  readonly displayLatestVideo = input<boolean>(undefined)
  readonly displayDescription = input<boolean>(undefined)

  readonly loaded = output<boolean>()

  channel: VideoChannel
  descriptionHTML: string
  totalVideos: number
  video: Video

  ngOnInit () {
    this.findInBulk.getChannel(this.name())
      .pipe(
        tap(channel => {
          this.channel = channel
        }),
        switchMap(() =>
          from(this.markdown.textMarkdownToHTML({
            markdown: this.channel.description,
            withEmoji: true,
            withHtml: true
          }))
        ),
        tap(html => {
          this.descriptionHTML = html
        }),
        switchMap(() => this.loadVideosObservable()),
        finalize(() => this.loaded.emit(true))
      ).subscribe({
        next: ({ total, data }) => {
          this.totalVideos = total
          this.video = data[0]

          this.cd.markForCheck()
        },

        error: err => this.notifier.error($localize`Error in channel miniature component: ${err.message}`)
      })
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
        switchMap(nsfwPolicy => {
          return this.videoService.listChannelVideos({ ...videoOptions, nsfw: this.videoService.nsfwPolicyToParam(nsfwPolicy) })
        })
      )
  }
}
