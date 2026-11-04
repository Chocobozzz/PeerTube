/* SystemJS module definition */
// eslint-disable-next-line no-var
declare var module: NodeModule

interface NodeModule {
  id: string
}

declare module 'markdown-it-emoji/lib/light.mjs'

declare module '*.scss'

declare module 'punycode.js' {
  const punycode: {
    toUnicode(input: string): string
    toASCII(input: string): string
  }

  export default punycode
}
