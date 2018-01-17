import * as WebTorrent from 'webtorrent'

let webtorrent = new WebTorrent()

function immutableAssign <T, U> (target: T, source: U) {
  return Object.assign<{}, T, U>({}, target, source)
}

  // Default interval -> 5 minutes
function dateIsValid (dateString: string, interval = 300000) {
  const dateToCheck = new Date(dateString)
  const now = new Date()

  return Math.abs(now.getTime() - dateToCheck.getTime()) <= interval
}

function wait (milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function webtorrentAdd (torrent: string, refreshWebTorrent = false) {
  if (refreshWebTorrent === true) webtorrent = new WebTorrent()

  return new Promise<WebTorrent.Torrent>(res => webtorrent.add(torrent, res))
}

// ---------------------------------------------------------------------------

export {
  dateIsValid,
  wait,
  webtorrentAdd,
  immutableAssign
}
