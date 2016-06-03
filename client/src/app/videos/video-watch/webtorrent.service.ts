// Don't use webtorrent typings for now
// It misses some little things I'll fix later
// <reference path="../../../../typings/globals/webtorrent/index.d.ts" />

import { Injectable } from '@angular/core';

// import WebTorrent = require('webtorrent');
declare var WebTorrent: any;

@Injectable()
export class WebTorrentService {
  // private client: WebTorrent.Client;
  private client: any;

  constructor() {
    this.client = new WebTorrent({ dht: false });
  }

  add(magnetUri: string, callback: Function) {
    return this.client.add(magnetUri, callback);
  }

  remove(magnetUri: string) {
    return this.client.remove(magnetUri);
  }
}
