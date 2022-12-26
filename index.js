import { EventEmitter } from 'events'
import {
  execFile,
  spawn
} from 'child_process'
import assert from 'webassert'

import { defaultOptions } from './lib/default-options.js'
import { emitYouTubeDLEvents } from './lib/youtube-dl-events.js'
import { createError } from './lib/create-error.js'

export { downloadFromGithub } from './lib/download-yt-dlp.js'

const executableName = 'yt-dlp'

export class BcDLP {
  constructor ({
    binPath = executableName,
    tag,
    assetName,
    platform,
    arch
  }) {
    this.binPath = binPath
    this.tag = tag
    this.assetName = assetName
    this.platform = platform
    this.arch = arch
  }

  exec (
    ytDlpArguments = [],
    options = {}
  ) {
    options = {
      ...defaultOptions(),
      ...options
    }
    assert(Array.isArray(ytDlpArguments), 'ytDlpArguments is an array')
    assert(typeof options === 'object', 'options is an object')

    const execEventEmitter = new EventEmitter()

    const ytDlpProcess = spawn(this.binPath, ytDlpArguments, options)
    execEventEmitter.ytDlpProcess = ytDlpProcess

    let stderrData = ''
    let processError

    ytDlpProcess.stdout.on('data', (data) => emitYouTubeDLEvents({
      stringData: data.toString(),
      emitter: execEventEmitter
    }))

    ytDlpProcess.stderr.on('data', (data) => (stderrData += data.toString()))

    ytDlpProcess.on('error', (error) => (processError = error))

    ytDlpProcess.on('close', (code) => {
      if (code === 0 || ytDlpProcess.killed) {
        execEventEmitter.emit('close', code)
      } else {
        execEventEmitter.emit('error', createError({ code, processError, stderrData }))
      }
    })

    return execEventEmitter
  }

  execPromise (
    ytDlpArguments = [],
    options = {}
  ) {
    const { binPath } = this
    let ytDlpProcess
    const ytDlpPromise = new Promise(
      (resolve, reject) => {
        options = {
          ...defaultOptions(),
          ...options
        }
        ytDlpProcess = execFile(
          binPath,
          ytDlpArguments,
          options,
          (error, stdout, stderr) => {
            if (error) {
              reject(createError({ code: error, stderrData: stderr }))
            } else {
              resolve(stdout)
            }
          }
        )
      }
    )

    ytDlpPromise.ytDlpProcess = ytDlpProcess
    return ytDlpPromise
  }

  execStream (
    ytDlpArguments = [],
    options = {}
  ) {
    options = {
      ...defaultOptions(),
      ...options
    }
    const { binPath } = this
    ytDlpArguments = ytDlpArguments.concat(['-o', '-'])
    const execEventEmitter = new EventEmitter()
    const ytDlpProcess = spawn(binPath, ytDlpArguments, options)
    execEventEmitter.ytDlpProcess = ytDlpProcess

    let stderrData = ''
    let processError

    ytDlpProcess.stderr.on('data', (data) => {
      const stringData = data.toString()

      emitYouTubeDLEvents({
        stringData: data.toString(),
        emitter: execEventEmitter
      })
      stderrData += stringData
    })
    ytDlpProcess.on('error', (error) => (processError = error))

    ytDlpProcess.on('close', (code) => {
      if (code === 0 || ytDlpProcess.killed) {
        execEventEmitter.emit('close', code)
      } else {
        execEventEmitter.emit('error', createError({ code, processError, stderrData }))
      }
    })
    return {
      readStream: ytDlpProcess.stdout,
      execEventEmitter
    }
  }

  async getExtractors () {
    const ytDlpStdout = await this.execPromise(['--list-extractors'])
    return ytDlpStdout.split('\n')
  }

  async getExtractorDescriptions () {
    const ytDlpStdout = await this.execPromise(['--extractor-descriptions'])
    return ytDlpStdout.split('\n')
  }

  async getHelp () {
    const ytDlpStdout = await this.execPromise(['--help'])
    return ytDlpStdout
  }

  async getUserAgent () {
    const ytDlpStdout = await this.execPromise(['--dump-user-agent'])
    return ytDlpStdout
  }

  async getVersion () {
    const ytDlpStdout = await this.execPromise(['--version'])
    return ytDlpStdout
  }

  async getVideoInfo (ytDlpArguments) {
    if (typeof ytDlpArguments === 'string') { ytDlpArguments = [ytDlpArguments] }
    if (
      !ytDlpArguments.includes('-f') &&
            !ytDlpArguments.includes('--format')
    ) { ytDlpArguments = ytDlpArguments.concat(['-f', 'best']) }

    const ytDlpStdout = await this.execPromise(ytDlpArguments.concat(['--dump-json']))
    try {
      return JSON.parse(ytDlpStdout)
    } catch (e) {
      return JSON.parse(
        '[' + ytDlpStdout.replace(/\n/g, ',').slice(0, -1) + ']'
      )
    }
  }
}
