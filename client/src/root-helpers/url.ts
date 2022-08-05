function getParamToggle (params: URLSearchParams, name: string, defaultValue?: boolean) {
  return params.has(name)
    ? (params.get(name) === '1' || params.get(name) === 'true')
    : defaultValue
}

function getParamString (params: URLSearchParams, name: string, defaultValue?: string) {
  return params.has(name)
    ? params.get(name)
    : defaultValue
}

function getToggle(params : any, name : string, defaultValue? : boolean){
  if(typeof params[name] === 'undefined') return defaultValue

  return params[name]
}

function getString(params : any, name : string, defaultValue? : string){
  if(typeof params[name] === 'undefined') return defaultValue

  return params[name]
}

function objectToUrlEncoded (obj: any) {
  const str: string[] = []
  for (const key of Object.keys(obj)) {
    str.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]))
  }

  return str.join('&')
}

export {
  getParamToggle,
  getParamString,
  objectToUrlEncoded,
  getString,
  getToggle
}
