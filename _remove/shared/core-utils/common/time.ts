function wait (milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

export {
  wait
}
