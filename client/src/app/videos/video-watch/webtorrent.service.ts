import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';

declare const WebTorrent;

@Injectable()
export class WebTorrentService {
  errors = new Subject<Error>();
  warnings = new Subject<Error>();

  // TODO: use WebTorrent @type
  // private client: WebTorrent.Client;
  private client: any;

  constructor() {
    this.client = new WebTorrent({ dht: false });

    this.client.on('error', (err) => this.errors.next(err));
    this.client.on('warning', (err) => this.warnings.next(err));
  }

  add(magnetUri: string, callback: Function) {
    return this.client.add(magnetUri, callback);
  }

  remove(magnetUri: string) {
    return this.client.remove(magnetUri);
  }

  has(magnetUri: string) {
    return this.client.get(magnetUri) !== null;
  }
}
