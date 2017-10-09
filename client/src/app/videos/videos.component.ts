import { Component, OnInit } from '@angular/core'

import { VideoService } from './shared'

@Component({
  template: '<router-outlet></router-outlet>'
})
export class VideosComponent implements OnInit {
  constructor (private videoService: VideoService) {}

  ngOnInit () {
    this.videoService.loadVideoCategories()
    this.videoService.loadVideoLicences()
    this.videoService.loadVideoLanguages()
  }
}
