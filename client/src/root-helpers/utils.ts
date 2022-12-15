function copyToClipboard (text: string) {
  const el = document.createElement('textarea')
  el.value = text
  el.setAttribute('readonly', '')
  el.style.position = 'absolute'
  el.style.left = '-9999px'
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

function wait (ms: number) {
  return new Promise<void>(res => {
    setTimeout(() => res(), ms)
  })
}

export {
  copyToClipboard,
  wait
}
