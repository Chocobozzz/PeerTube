class YoutubeDLBaseBuilder {
  normalizeObject (obj: any): any {
    const newObj: any = {}

    for (const key of Object.keys(obj)) {
      // Deprecated key
      if (key === 'resolution') continue

      const value = obj[key]

      if (typeof value === 'string') {
        newObj[key] = value.normalize()
      } else {
        newObj[key] = value
      }
    }

    return newObj
  }
}

// ---------------------------------------------------------------------------

export {
  YoutubeDLBaseBuilder
}
