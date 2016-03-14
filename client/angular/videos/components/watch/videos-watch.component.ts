/// <reference path='../../../../typings/browser/ambient/webtorrent/webtorrent.d.ts' />

import { Component, OnInit, ElementRef } from 'angular2/core';
import { RouteParams } from 'angular2/router';

declare var WebTorrent: any;

import { Video } from '../../models/video';
import { VideosService } from '../../services/videos.service';

@Component({
  selector: 'my-video-watch',
  templateUrl: 'app/angular/videos/components/watch/videos-watch.component.html',
  styleUrls: [ 'app/angular/videos/components/watch/videos-watch.component.css' ]
})

export class VideosWatchComponent {
  video: Video;

  private client: any;

  constructor(
    private _videosService: VideosService,
    private _routeParams: RouteParams,
    private _elementRef: ElementRef
  ) {
    this.client = new WebTorrent({ dht: false });
  }

  ngOnInit() {
    let id = this._routeParams.get('id');
    this._videosService.getVideo(id).subscribe(
      video => this.loadVideo(video),
      error => alert(error)
    );
  }

  loadVideo(video: Video) {
    this.video = video;

    this.client.add(this.video.magnetUri, (torrent) => {
      torrent.files[0].appendTo(this._elementRef.nativeElement, (err) => {
        if (err) {
          alert('Cannot append the file.');
          console.error(err);
        }
      })
    })
  }
}
