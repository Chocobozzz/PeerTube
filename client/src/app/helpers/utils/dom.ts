function scrollToTop (behavior: 'auto' | 'smooth' = 'auto') {
  window.scrollTo({
    left: 0,
    top: 0,
    behavior
  })
}

function isInViewport (el: HTMLElement, container: HTMLElement = document.documentElement) {
  const boundingEl = el.getBoundingClientRect()
  const boundingContainer = container.getBoundingClientRect()

  const relativePos = {
    top: 0,
    left: 0,
    bottom: 0,
    right: 0
  }

  relativePos.top = boundingEl.top - boundingContainer.top
  relativePos.left = boundingEl.left - boundingContainer.left

  return relativePos.top >= 0 &&
    relativePos.left >= 0 &&
    boundingEl.bottom <= boundingContainer.bottom &&
    boundingEl.right <= boundingContainer.right
}

function isXPercentInViewport (el: HTMLElement, percentVisible: number) {
  const rect = el.getBoundingClientRect()
  const windowHeight = (window.innerHeight || document.documentElement.clientHeight)

  return !(
    Math.floor(100 - (((rect.top >= 0 ? 0 : rect.top) / +-(rect.height / 1)) * 100)) < percentVisible ||
    Math.floor(100 - ((rect.bottom - windowHeight) / rect.height) * 100) < percentVisible
  )
}

export {
  scrollToTop,
  isInViewport,
  isXPercentInViewport
}
