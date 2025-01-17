export function isIOS () {
  if (/iPad|iPhone|iPod/.test(navigator.platform)) {
    return true
  }

  // Detect iPad Desktop mode
  return !!(navigator.maxTouchPoints &&
      navigator.maxTouchPoints > 2 &&
      navigator.platform.includes('MacIntel'))
}

export function isSafari () {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}

export function isMobile () {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

export function isIphone () {
  return /iPhone/i.test(navigator.userAgent)
}

export function isAndroid () {
  return /Android/i.test(navigator.userAgent)
}

