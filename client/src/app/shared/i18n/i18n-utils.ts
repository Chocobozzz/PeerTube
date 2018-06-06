function peertubeTranslate (str: string, translations: { [ id: string ]: string }) {
  return translations[str] ? translations[str] : str
}

export {
  peertubeTranslate
}
