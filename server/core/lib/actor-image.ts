import maxBy from 'lodash-es/maxBy.js'

function getBiggestActorImage <T extends { width: number }> (images: T[]) {
  const image = maxBy(images, 'width')

  // If width is null, maxBy won't return a value
  if (!image) return images[0]

  return image
}

export {
  getBiggestActorImage
}
