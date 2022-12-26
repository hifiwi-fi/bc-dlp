import assert from 'webassert'

export function createError ({
  code,
  processError,
  stderrData
}) {
  assert(code, 'code required')
  let errorMessage = '\nError code: ' + code
  if (processError) errorMessage += '\n\nProcess error:\n' + processError
  if (stderrData) errorMessage += '\n\nStderr:\n' + stderrData
  return new Error(errorMessage)
}
