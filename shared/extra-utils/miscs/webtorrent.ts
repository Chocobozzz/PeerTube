import { readFile } from 'fs-extra'
import parseTorrent from 'parse-torrent'
import { basename, join } from 'path'
import * as WebTorrent from 'webtorrent'
import { VideoFile } from '@shared/models'
import { PeerTubeServer } from '../server'

let webtorrent: WebTorrent.Instance

function webtorrentAdd (torrent: string, refreshWebTorrent = false) {
  const WebTorrent = require('webtorrent')

  if (!webtorrent) webtorrent = new WebTorrent()
  if (refreshWebTorrent === true) webtorrent = new WebTorrent()

  return new Promise<WebTorrent.Torrent>(res => webtorrent.add(torrent, res))
}

async function parseTorrentVideo (server: PeerTubeServer, file: VideoFile) {
  const torrentName = basename(file.torrentUrl)
  const torrentPath = server.servers.buildDirectory(join('torrents', torrentName))

  const data = await readFile(torrentPath)

  return parseTorrent(data)
}

export {
  webtorrentAdd,
  parseTorrentVideo
}
