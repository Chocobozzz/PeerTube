function isPromise (value: any) {
  return value && typeof value.then === 'function'
}

function isCatchable (value: any) {
  return value && typeof value.catch === 'function'
}

export {
  isPromise,
  isCatchable
}
