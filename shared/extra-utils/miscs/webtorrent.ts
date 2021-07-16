import { readFile } from 'fs-extra'
import * as parseTorrent from 'parse-torrent'
import { join } from 'path'
import * as WebTorrent from 'webtorrent'
import { PeerTubeServer } from '../server'

let webtorrent: WebTorrent.Instance

function webtorrentAdd (torrent: string, refreshWebTorrent = false) {
  const WebTorrent = require('webtorrent')

  if (!webtorrent) webtorrent = new WebTorrent()
  if (refreshWebTorrent === true) webtorrent = new WebTorrent()

  return new Promise<WebTorrent.Torrent>(res => webtorrent.add(torrent, res))
}

async function parseTorrentVideo (server: PeerTubeServer, videoUUID: string, resolution: number) {
  const torrentName = videoUUID + '-' + resolution + '.torrent'
  const torrentPath = server.servers.buildDirectory(join('torrents', torrentName))

  const data = await readFile(torrentPath)

  return parseTorrent(data)
}

export {
  webtorrentAdd,
  parseTorrentVideo
}
