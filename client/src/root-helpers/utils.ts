import { environment } from '../environments/environment'

function objectToUrlEncoded (obj: any) {
  const str: string[] = []
  for (const key of Object.keys(obj)) {
    str.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]))
  }

  return str.join('&')
}

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

// Thanks: https://github.com/uupaa/dynamic-import-polyfill
function importModule (path: string) {
  return new Promise((resolve, reject) => {
    const vector = '$importModule$' + Math.random().toString(32).slice(2)
    const script = document.createElement('script')

    const destructor = () => {
      delete window[ vector ]
      script.onerror = null
      script.onload = null
      script.remove()
      URL.revokeObjectURL(script.src)
      script.src = ''
    }

    script.defer = true
    script.type = 'module'

    script.onerror = () => {
      reject(new Error(`Failed to import: ${path}`))
      destructor()
    }
    script.onload = () => {
      resolve(window[ vector ])
      destructor()
    }
    const absURL = (environment.apiUrl || window.location.origin) + path
    const loader = `import * as m from "${absURL}"; window.${vector} = m;` // export Module
    const blob = new Blob([ loader ], { type: 'text/javascript' })
    script.src = URL.createObjectURL(blob)

    document.head.appendChild(script)
  })
}

function wait (ms: number) {
  return new Promise<void>(res => {
    setTimeout(() => res(), ms)
  })
}

export {
  copyToClipboard,
  importModule,
  objectToUrlEncoded,
  wait
}
