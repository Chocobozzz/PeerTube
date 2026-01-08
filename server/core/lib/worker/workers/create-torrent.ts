import createTorrent from 'create-torrent'

export default function createTorrentPromise (
  options: {
    path: string
  } & Parameters<typeof createTorrent>[1]
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    createTorrent(options.path, options, (err, torrent) => {
      if (err) return reject(err)

      resolve(torrent)
    })
  })
}
