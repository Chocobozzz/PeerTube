function imageToDataURL (input: File | Blob) {
  return new Promise<string>(res => {
    const reader = new FileReader()

    reader.onerror = err => console.error('Cannot read input file.', err)
    reader.onloadend = () => res(reader.result as string)
    reader.readAsDataURL(input)
  })
}

export {
  imageToDataURL
}
