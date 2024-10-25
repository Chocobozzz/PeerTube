import { MonoTypeOperatorFunction } from 'rxjs/internal/types'
import { shareReplay } from 'rxjs/operators'

function copyToClipboard (text: string, container?: HTMLElement) {
  if (!container) container = document.body

  const el = document.createElement('textarea')
  el.value = text
  el.setAttribute('readonly', '')
  el.style.position = 'absolute'
  el.style.left = '-9999px'
  container.appendChild(el)
  el.select()
  document.execCommand('copy')
  container.removeChild(el)
}

function wait (ms: number) {
  return new Promise<void>(res => {
    setTimeout(() => res(), ms)
  })
}

function shortCacheObservable<T> (): MonoTypeOperatorFunction<T> {
  return shareReplay({ refCount: true, windowTime: 500 })
}

export {
  copyToClipboard,
  shortCacheObservable,
  wait
}
