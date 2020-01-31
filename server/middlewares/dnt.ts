const advertiseDoNotTrack = (_, res, next) => {
  res.setHeader('Tk', 'N')
  return next()
}

// ---------------------------------------------------------------------------

export {
  advertiseDoNotTrack
}
