function scrollToTop (behavior: 'auto' | 'smooth' = 'auto') {
  window.scrollTo({
    left: 0,
    top: 0,
    behavior
  })
}

function isInViewport (el: HTMLElement) {
  const bounding = el.getBoundingClientRect()
  return (
    bounding.top >= 0 &&
      bounding.left >= 0 &&
      bounding.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      bounding.right <= (window.innerWidth || document.documentElement.clientWidth)
  )
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
