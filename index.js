import { EventEmitter } from 'events'
import {
  execFile as execFileCb,
  spawn
} from 'child_process'
import assert from 'webassert'
import { promisify } from 'util'

import { defaultOptions } from './lib/default-options.js'
import { emitYouTubeDLEvents } from './lib/youtube-dl-events.js'
import { createError } from './lib/create-error.js'

export { downloadFromGithub } from './lib/download-yt-dlp.js'

const execFile = promisify(execFileCb)

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

    const child = spawn(this.binPath, ytDlpArguments, options)
    execEventEmitter.child = child

    let stderrData = ''
    let processError

    child.stdout.on('data', (data) => emitYouTubeDLEvents({
      stringData: data.toString(),
      emitter: execEventEmitter
    }))

    child.stderr.on('data', (data) => (stderrData += data.toString()))

    child.on('error', (error) => (processError = error))

    child.on('close', (code) => {
      if (code === 0 || child.killed) {
        execEventEmitter.emit('close', code)
      } else {
        execEventEmitter.emit('error', createError({ code, processError, stderrData }))
      }
    })

    return execEventEmitter
  }

  async execPromise (
    ytDlpArguments = [],
    options = {}
  ) {
    const { binPath } = this

    options = {
      ...defaultOptions(),
      ...options
    }

    try {
      const { stdout } = await execFile(
        binPath,
        ytDlpArguments,
        options
      )
      return stdout
    } catch (err) {
      throw createError({ code: err, stderrData: err.stderr })
    }
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
    const child = spawn(binPath, ytDlpArguments, options)
    execEventEmitter.child = child

    let stderrData = ''
    let processError

    child.stderr.on('data', (data) => {
      const stringData = data.toString()

      emitYouTubeDLEvents({
        stringData: data.toString(),
        emitter: execEventEmitter
      })
      stderrData += stringData
    })
    child.on('error', (error) => (processError = error))

    child.on('close', (code) => {
      if (code === 0 || child.killed) {
        execEventEmitter.emit('close', code)
      } else {
        execEventEmitter.emit('error', createError({ code, processError, stderrData }))
      }
    })
    return {
      readStream: child.stdout,
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
