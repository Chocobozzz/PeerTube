function getAPId (object: string | { id: string }) {
  if (typeof object === 'string') return object

  return object.id
}

export {
  getAPId
}
