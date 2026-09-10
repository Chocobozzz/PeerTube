export interface ServerCLIOptions {
  client: boolean
  plugins: boolean
  benchmarkStartup: boolean
}

let options: ServerCLIOptions = {
  client: true,
  plugins: true,
  benchmarkStartup: false
}

export function setServerCLIOptions (newOptions: ServerCLIOptions) {
  options = newOptions
}

export function getServerCLIOptions () {
  return options
}
