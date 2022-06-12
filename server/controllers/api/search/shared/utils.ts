async function searchLocalUrl <T> (url: string, finder: (url: string) => Promise<T>) {
  const data = await finder(url)
  if (data) return data

  return finder(removeQueryParams(url))
}

export {
  searchLocalUrl
}

// ---------------------------------------------------------------------------

function removeQueryParams (url: string) {
  return url.split('?').shift()
}
