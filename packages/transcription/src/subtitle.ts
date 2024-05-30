export const srtToTxt = (srtContent: string) => srtContent.replace(/^\n*\d+\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n/gm, '')
