import assert from 'webassert'

const progressRegex = /\[download\] *(.*) of *([^ ]*)(:? *at *([^ ]*))?(:? *ETA *([^ ]*))?/

export function emitYouTubeDLEvents ({
  stringData,
  emitter
}) {
  assert(stringData, 'stringData required')
  assert(emitter, 'emitter data required')
  const outputLines = stringData.split(/\r|\n/g).filter(Boolean)

  for (const outputLine of outputLines) {
    if (outputLine[0] === '[') {
      const progressMatch = outputLine.match(progressRegex)
      if (progressMatch) {
        const progressObject = {}
        progressObject.percent = parseFloat(
          progressMatch[1].replace('%', '')
        )
        progressObject.totalSize = progressMatch[2].replace(
          '~',
          ''
        )
        progressObject.currentSpeed = progressMatch[4]
        progressObject.eta = progressMatch[6];

        (emitter).emit(
          'progress',
          progressObject
        )
      }

      const eventType = outputLine
        .split(' ')[0]
        .replace('[', '')
        .replace(']', '')
      const eventData = outputLine.substring(
        outputLine.indexOf(' '),
        outputLine.length
      );
      (emitter).emit(
        'ytDlpEvent',
        eventType,
        eventData
      )
    }
  }
}
