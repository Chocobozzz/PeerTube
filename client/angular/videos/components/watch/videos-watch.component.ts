import { Component, OnInit, ElementRef } from 'angular2/core';
import { RouteParams, CanDeactivate, ComponentInstruction } from 'angular2/router';
import { BytesPipe } from 'angular-pipes/src/math/bytes.pipe';

// TODO import it with systemjs
declare var WebTorrent: any;

import { Video } from '../../models/video';
import { VideosService } from '../../services/videos.service';

@Component({
  selector: 'my-video-watch',
  templateUrl: 'app/angular/videos/components/watch/videos-watch.component.html',
  styleUrls: [ 'app/angular/videos/components/watch/videos-watch.component.css' ],
  pipes: [ BytesPipe ]
})

export class VideosWatchComponent implements OnInit, CanDeactivate {
  video: Video;
  downloadSpeed: number;
  uploadSpeed: number;
  numPeers: number;

  private _interval: number;
  private client: any;

  constructor(
    private _videosService: VideosService,
    private _routeParams: RouteParams,
    private _elementRef: ElementRef
  ) {
    // TODO: use a service
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
    console.log('Adding ' + this.video.magnetUri + '.');
    this.client.add(this.video.magnetUri, (torrent) => {
      console.log('Added ' + this.video.magnetUri + '.');
      torrent.files[0].appendTo(this._elementRef.nativeElement.querySelector('.embed-responsive'), (err) => {
        if (err) {
          alert('Cannot append the file.');
          console.error(err);
        }
      });

      // Refresh each second
      this._interval = setInterval(() => {
        this.downloadSpeed = torrent.downloadSpeed;
        this.uploadSpeed = torrent.uploadSpeed;
        this.numPeers = torrent.numPeers;
      }, 1000);
    });
  }

  routerCanDeactivate(next: ComponentInstruction, prev: ComponentInstruction) : any {
    console.log('Removing video from webtorrent.');
    clearInterval(this._interval)
    this.client.remove(this.video.magnetUri);
    return true;
  }
}
