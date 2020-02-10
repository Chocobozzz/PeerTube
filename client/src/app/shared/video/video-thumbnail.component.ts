import { Component, EventEmitter, Input, Output } from '@angular/core'
import { Video } from './video.model'
import { ScreenService } from '@app/shared/misc/screen.service'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-video-thumbnail',
  styleUrls: [ './video-thumbnail.component.scss' ],
  templateUrl: './video-thumbnail.component.html'
})
export class VideoThumbnailComponent {
  @Input() video: Video
  @Input() nsfw = false
  @Input() routerLink: any[]
  @Input() queryParams: { [ p: string ]: any }

  @Input() displayWatchLaterPlaylist: boolean
  @Input() inWatchLaterPlaylist: boolean

  @Output() watchLaterClick = new EventEmitter<boolean>()

  addToWatchLaterText: string
  addedToWatchLaterText: string

  constructor (
    private screenService: ScreenService,
    private i18n: I18n
  ) {
    this.addToWatchLaterText = this.i18n('Add to watch later')
    this.addedToWatchLaterText = this.i18n('Remove from watch later')
  }

  getImageUrl () {
    if (!this.video) return ''

    if (this.screenService.isInMobileView()) {
      return this.video.previewUrl
    }

    return this.video.thumbnailUrl
  }

  getProgressPercent () {
    if (!this.video.userHistory) return 0

    const currentTime = this.video.userHistory.currentTime

    return (currentTime / this.video.duration) * 100
  }

  getVideoRouterLink () {
    if (this.routerLink) return this.routerLink

    return [ '/videos/watch', this.video.uuid ]
  }

  onWatchLaterClick (event: Event) {
    this.watchLaterClick.emit(this.inWatchLaterPlaylist)

    event.stopPropagation()
    return false
  }
}
