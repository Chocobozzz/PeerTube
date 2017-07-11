import { Injectable } from '@angular/core'
import { Subject } from 'rxjs/Subject'

import * as WebTorrent from 'webtorrent'

@Injectable()
export class WebTorrentService {
  errors = new Subject<string | Error>()

  private client: WebTorrent.Instance

  constructor () {
    this.client = new WebTorrent({ dht: false })

    this.client.on('error', err => this.errors.next(err))
  }

  add (magnetUri: string, callback: (torrent: WebTorrent.Torrent) => any) {
    return this.client.add(magnetUri, callback)
  }

  remove (magnetUri: string) {
    return this.client.remove(magnetUri)
  }

  has (magnetUri: string) {
    return this.client.get(magnetUri) !== null
  }
}
