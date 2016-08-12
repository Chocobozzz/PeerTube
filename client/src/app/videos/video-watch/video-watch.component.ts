import { Component, ElementRef, NgZone, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

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

export class VideoWatchComponent implements OnInit, OnDestroy {
  private static LOADTIME_TOO_LONG: number = 30000;

  downloadSpeed: number;
  error: boolean = false;
  loading: boolean = false;
  numPeers: number;
  uploadSpeed: number;
  video: Video;

  private errorTimer: NodeJS.Timer;
  private sub: any;
  private torrentInfosInterval: NodeJS.Timer;

  constructor(
    private elementRef: ElementRef,
    private ngZone: NgZone,
    private route: ActivatedRoute,
    private videoService: VideoService,
    private webTorrentService: WebTorrentService
  ) {}

  loadVideo() {
    // Reset the error
    this.error = false;
    // We are loading the video
    this.loading = true;

    console.log('Adding ' + this.video.magnetUri + '.');

    // The callback might never return if there are network issues
    // So we create a timer to inform the user the load is abnormally long
    this.errorTimer = setTimeout(() => this.loadTooLong(), VideoWatchComponent.LOADTIME_TOO_LONG);

    this.webTorrentService.add(this.video.magnetUri, (torrent) => {
      // Clear the error timer
      clearTimeout(this.errorTimer);
      // Maybe the error was fired by the timer, so reset it
      this.error = false;

      // We are not loading the video anymore
      this.loading = false;

      console.log('Added ' + this.video.magnetUri + '.');
      torrent.files[0].appendTo(this.elementRef.nativeElement.querySelector('.embed-responsive'), (err) => {
        if (err) {
          alert('Cannot append the file.');
          console.error(err);
        }
      });

      this.runInProgress(torrent);
    });
  }

  ngOnDestroy() {
    console.log('Removing video from webtorrent.');
    clearInterval(this.torrentInfosInterval);
    this.webTorrentService.remove(this.video.magnetUri);

    this.sub.unsubscribe();
  }

  ngOnInit() {
    this.sub = this.route.params.subscribe(routeParams => {
      let id = routeParams['id'];
      this.videoService.getVideo(id).subscribe(
        video => {
          this.video = video;
          this.loadVideo();
        },
        error => alert(error)
      );
    });
  }

  private loadTooLong() {
    this.error = true;
    console.error('The video load seems to be abnormally long.');
  }

  private runInProgress(torrent: any) {
    // Refresh each second
    this.torrentInfosInterval = setInterval(() => {
      this.ngZone.run(() => {
        this.downloadSpeed = torrent.downloadSpeed;
        this.numPeers = torrent.numPeers;
        this.uploadSpeed = torrent.uploadSpeed;
      });
    }, 1000);
  }
}
