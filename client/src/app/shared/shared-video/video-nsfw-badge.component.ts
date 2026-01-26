import { CommonModule } from '@angular/common'
import { Component, inject, input, OnInit } from '@angular/core'
import { Video } from '@peertube/peertube-models'
import { VideoService } from '../shared-main/video/video.service'
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'

@Component({
  selector: 'my-video-nsfw-badge',
  templateUrl: './video-nsfw-badge.component.html',
  standalone: true,
  imports: [
    CommonModule,
    NgbTooltipModule
  ]
})
export class VideoNSFWBadgeComponent implements OnInit {
  private videoService = inject(VideoService)

  readonly video = input.required<Pick<Video, 'nsfw' | 'nsfwFlags'>>()
  readonly theme = input<'yellow' | 'red'>('yellow')

  tooltip: string
  badgeClass: string

  ngOnInit () {
    this.tooltip = this.videoService.buildNSFWTooltip(this.video())

    this.badgeClass = this.theme() === 'yellow'
      ? 'badge-warning'
      : 'badge-danger'
  }
}
