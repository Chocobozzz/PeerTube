function isValidPlayerMode (value: any) {
  // TODO: remove webtorrent in v7
  return value === 'webtorrent' || value === 'web-video' || value === 'p2p-media-loader'
}

// ---------------------------------------------------------------------------

export {
  isValidPlayerMode
}
