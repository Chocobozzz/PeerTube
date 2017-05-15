function setUsersSort (req, res, next) {
  if (!req.query.sort) req.query.sort = '-createdAt'

  return next()
}

function setVideoAbusesSort (req, res, next) {
  if (!req.query.sort) req.query.sort = '-createdAt'

  return next()
}

function setVideosSort (req, res, next) {
  if (!req.query.sort) req.query.sort = '-createdAt'

  return next()
}

// ---------------------------------------------------------------------------

export {
  setUsersSort,
  setVideoAbusesSort,
  setVideosSort
}
