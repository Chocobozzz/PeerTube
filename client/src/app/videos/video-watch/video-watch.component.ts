import { Component, ElementRef, OnInit } from '@angular/core';
import { CanDeactivate, ComponentInstruction, RouteParams } from '@angular/router-deprecated';

import { BytesPipe } from 'angular-pipes/src/math/bytes.pipe';

import { LoaderComponent, Video, VideoService } from '../shared';
import { WebTorrentService } from './webtorrent.service';

@Component({
  selector: 'my-video-watch',
  template: require('./video-watch.component.html'),
  styles: [ require('./video-watch.component.scss') ],
  providers: [ WebTorrentService ],
  directives: [ LoaderComponent ],
  pipes: [ BytesPipe ]
})

export class VideoWatchComponent implements OnInit, CanDeactivate {
  downloadSpeed: number;
  loading: boolean = false;
  numPeers: number;
  uploadSpeed: number;
  video: Video;

  private interval: NodeJS.Timer;

  constructor(
    private elementRef: ElementRef,
    private routeParams: RouteParams,
    private videoService: VideoService,
    private webTorrentService: WebTorrentService
  ) {}

  loadVideo(video: Video) {
    this.loading = true;
    this.video = video;
    console.log('Adding ' + this.video.magnetUri + '.');

    this.webTorrentService.add(this.video.magnetUri, (torrent) => {
      this.loading = false;
      console.log('Added ' + this.video.magnetUri + '.');
      torrent.files[0].appendTo(this.elementRef.nativeElement.querySelector('.embed-responsive'), (err) => {
        if (err) {
          alert('Cannot append the file.');
          console.error(err);
        }
      });

      // Refresh each second
      this.interval = setInterval(() => {
        this.downloadSpeed = torrent.downloadSpeed;
        this.numPeers = torrent.numPeers;
        this.uploadSpeed = torrent.uploadSpeed;
      }, 1000);
    });
  }

  ngOnInit() {
    let id = this.routeParams.get('id');
    this.videoService.getVideo(id).subscribe(
      video => this.loadVideo(video),
      error => alert(error)
    );
  }

  routerCanDeactivate(next: ComponentInstruction, prev: ComponentInstruction) {
    console.log('Removing video from webtorrent.');
    clearInterval(this.interval);
    this.webTorrentService.remove(this.video.magnetUri);
    return true;
  }
}
