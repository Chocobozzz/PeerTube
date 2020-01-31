// Thanks to https://regex101.com
function regexpCapture (str: string, regex: RegExp, maxIterations = 100) {
  const result: RegExpExecArray[] = []
  let m: RegExpExecArray
  let i = 0

  // tslint:disable:no-conditional-assignment
  while ((m = regex.exec(str)) !== null && i < maxIterations) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (m.index === regex.lastIndex) {
      regex.lastIndex++
    }

    result.push(m)
    i++
  }

  return result
}

export {
  regexpCapture
}
