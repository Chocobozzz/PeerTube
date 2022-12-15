function isValidPlayerMode (value: any) {
  return value === 'webtorrent' || value === 'p2p-media-loader'
}

// ---------------------------------------------------------------------------

export {
  isValidPlayerMode
}
