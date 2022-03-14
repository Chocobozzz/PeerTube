function isIOS () {
  if (/iPad|iPhone|iPod/.test(navigator.platform)) {
    return true
  }

  // Detect iPad Desktop mode
  return !!(navigator.maxTouchPoints &&
      navigator.maxTouchPoints > 2 &&
      navigator.platform.includes('MacIntel'))
}

function isSafari () {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}

function isMobile () {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

export {
  isIOS,
  isSafari,
  isMobile
}
