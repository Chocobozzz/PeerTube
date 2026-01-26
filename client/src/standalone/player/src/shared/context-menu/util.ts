export function findElPosition (el: HTMLElement) {
  let box: DOMRect

  if (el.getBoundingClientRect && el.parentNode) {
    box = el.getBoundingClientRect()
  }

  if (!box) return { left: 0, top: 0 }

  const docEl = document.documentElement
  const body = document.body

  const clientLeft = docEl.clientLeft || body.clientLeft || 0
  const scrollLeft = window.pageXOffset || body.scrollLeft
  const left = box.left + scrollLeft - clientLeft

  const clientTop = docEl.clientTop || body.clientTop || 0
  const scrollTop = window.pageYOffset || body.scrollTop
  const top = box.top + scrollTop - clientTop

  // Android sometimes returns slightly off decimal values, so need to round
  return {
    left: Math.round(left),
    top: Math.round(top)
  }
}

export function getPointerPosition (el: HTMLElement, event: TouchEvent & MouseEvent) {
  const position: { y?: number, x?: number } = {}

  const box = findElPosition(el)
  const boxW = el.offsetWidth
  const boxH = el.offsetHeight
  const boxY = box.top
  const boxX = box.left
  let pageY = event.pageY
  let pageX = event.pageX

  if (event.changedTouches) {
    pageX = event.changedTouches[0].pageX
    pageY = event.changedTouches[0].pageY
  }

  position.y = Math.max(0, Math.min(1, ((boxY - pageY) + boxH) / boxH))
  position.x = Math.max(0, Math.min(1, (pageX - boxX) / boxW))

  return position
}

export function isFunction (functionToCheck: any) {
  return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]'
}
