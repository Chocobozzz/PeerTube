import * as WebTorrent from 'webtorrent'

let webtorrent: WebTorrent.Instance

function webtorrentAdd (torrent: string, refreshWebTorrent = false) {
  const WebTorrent = require('webtorrent')

  if (!webtorrent) webtorrent = new WebTorrent()
  if (refreshWebTorrent === true) webtorrent = new WebTorrent()

  return new Promise<WebTorrent.Torrent>(res => webtorrent.add(torrent, res))
}

export {
  webtorrentAdd
}
