import { Component, Input, OnInit } from '@angular/core'
import { HooksService } from '@app/core'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { TimeDurationFormatterPipe } from '../../../../shared/shared-main/date/time-duration-formatter.pipe'
import { GlobalIconComponent } from '../../../../shared/shared-icons/global-icon.component'
import { RouterLink } from '@angular/router'
import { NgIf, NgFor, DatePipe } from '@angular/common'

type PluginMetadata = {
  label: string

  value?: string
  safeHTML?: string
}

@Component({
  selector: 'my-video-attributes',
  templateUrl: './video-attributes.component.html',
  styleUrls: [ './video-attributes.component.scss' ],
  standalone: true,
  imports: [ NgIf, RouterLink, GlobalIconComponent, NgFor, DatePipe, TimeDurationFormatterPipe ]
})
export class VideoAttributesComponent implements OnInit {
  @Input() video: VideoDetails

  pluginMetadata: PluginMetadata[] = []

  constructor (private hooks: HooksService) { }

  async ngOnInit () {
    this.pluginMetadata = await this.hooks.wrapObject(
      this.pluginMetadata,
      'video-watch',
      'filter:video-watch.video-plugin-metadata.result',
      { video: this.video }
    )
  }

  getVideoHost () {
    return this.video.channel.host
  }

  getVideoTags () {
    if (!this.video || Array.isArray(this.video.tags) === false) return []

    return this.video.tags
  }
}
