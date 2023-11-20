import tap from 'tap'
import { join } from 'path'
import { stat, unlink } from 'fs/promises'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import tmp from 'p-temporary-directory'

import { downloadFromGithub, BcDLP } from './index.js'

const testVideoId = 'C0DPdy98e4c'
const testVideoURL = 'https://www.youtube.com/watch?v=' + testVideoId
// const expectedVideoSize = 170139

const token = process?.env?.GITHUB_TOKEN

const [tmpdir, cleanup] = await tmp()
let results

tap.teardown(async () => {
  await cleanup()
  console.log('cleaned up folder')
})

tap.test('download a bin', async t => {
  const octokitOpts = token ? { auth: token } : null
  results = await downloadFromGithub({
    filepath: join(tmpdir, 'yt-dlp'),
    octokitOpts
  })
  t.ok(results, 'downloaded')
})

tap.test('download video with promise', async t => {
  const dir = t.testdir()
  const testVideoPath = join(dir, 'testVideo.mp4')

  const bcDLP = new BcDLP(results)

  t.ok(bcDLP, 'instance created')

  const downloadPromise = bcDLP.execPromise([
    testVideoURL,
    '-f',
    'worst',
    '-o',
    testVideoPath
  ])

  await downloadPromise

  const stats = await stat(testVideoPath)
  t.ok(stats, 'video exists')
  t.ok(stats.size > 100)
  await unlink(testVideoPath)
})

tap.test('download video with event emitter', async t => {
  const dir = t.testdir()
  const testVideoPath = join(dir, 'testVideo.mp4')

  const bcDLP = new BcDLP(results)
  t.ok(bcDLP, 'instance created')

  const bcDLPEventEmitter = bcDLP.exec([
    testVideoURL,
    '-f',
    'worst',
    '-o',
    testVideoPath
  ])

  await checkEventEmitter({ t, bcDLPEventEmitter, testVideoPath })
})

tap.test('download video with readable stream', async t => {
  const dir = t.testdir()
  const testVideoPath = join(dir, 'testVideo.mp4')

  const bcDLP = new BcDLP(results)
  t.ok(bcDLP, 'instance created')

  const { readStream, execEventEmitter } = bcDLP.execStream([
    testVideoURL,
    '-f',
    'worst'
  ])

  const pipe = pipeline(readStream, createWriteStream(testVideoPath))
  await checkReadableStream({ t, bcDLPStream: readStream, execEventEmitter, testVideoPath, pipe })
})

tap.test('abort event emitter download', async t => {
  const dir = t.testdir()
  const testVideoPath = join(dir, 'testVideo.mp4')

  const bcDLP = new BcDLP(results)
  t.ok(bcDLP, 'instance created')

  const controller = new AbortController()
  const bcDLPEventEmitter = bcDLP.exec([testVideoURL, '-f', 'worst', '-o', testVideoPath], { signal: controller.signal })
  controller.abort()
  t.ok(bcDLPEventEmitter.child?.killed, 'process is aborted')
})

tap.test('abort stream download', async t => {
  const dir = t.testdir()
  const testVideoPath = join(dir, 'testVideo.mp4')

  const bcDLP = new BcDLP(results)
  t.ok(bcDLP, 'instance created')

  const controller = new AbortController()
  const { execEventEmitter } = bcDLP.execStream([testVideoURL, '-f', 'worst', '-o', testVideoPath], { signal: controller.signal })
  controller.abort()
  t.ok(execEventEmitter.child?.killed, 'process is aborted')
})

tap.todo('abort promise download', async t => {
  // This test crashes when aborting yt-dlp for some reason.
  const dir = t.testdir()
  const testVideoPath = join(dir, 'testVideo.mp4')

  const bcDLP = new BcDLP('yt-dlp')
  t.ok(bcDLP, 'instance created')

  const controller = new AbortController()
  const execPromise = bcDLP.execPromise([testVideoURL, '-f', 'worst', '-o', testVideoPath], { signal: controller.signal })

  controller.abort()
  t.ok(execPromise.child?.killed, 'process is aborted')
})

tap.test('video Info should have title Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film', async (t) => {
  const bcDLP = new BcDLP(results)
  const videoInfo = await bcDLP.getVideoInfo(
    'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
  )

  t.equal(videoInfo.title, 'Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film', 'title is correct')
})

tap.test('version should start with a date', async (t) => {
  const bcDLP = new BcDLP(results)
  const versionString = await bcDLP.getVersion()

  t.ok(isValidVersion(versionString), 'valid version string')
})

tap.test('user agent should be a string with at least 10 characters', async (t) => {
  const bcDLP = new BcDLP(results)

  const userAgentString = await bcDLP.getUserAgent()
  t.equal(typeof userAgentString, 'string', 'user agent is a string')
  t.ok(userAgentString.length >= 10, 'user agent string is greater than 10 chars')
})

tap.test('help should include explanation for version setting', async (t) => {
  const bcDLP = new BcDLP(results)

  const helpString = await bcDLP.getHelp()
  t.equal(typeof helpString, 'string', 'help text is a string')
  t.ok(helpString.includes('--version'), 'help string includes --version')
})

tap.test('extractor list should include youtube', async (t) => {
  const bcDLP = new BcDLP(results)

  const extractorList = await bcDLP.getExtractors()
  t.ok(Array.isArray(extractorList), 'extractor list is an array')
  t.ok(extractorList.includes('youtube'), 'extractor list includes youtube')
})

tap.test('extractor description list should include YouTube.com playlists', async (t) => {
  const bcDLP = new BcDLP(results)

  const extractorList = await bcDLP.getExtractorDescriptions()

  t.ok(Array.isArray(extractorList), 'Extractor descriptions is array')
  t.ok(extractorList.includes('youtube:playlist: YouTube playlists'), 'extractor descriptions includes youtube playlists')
})

async function checkEventEmitter ({ t, bcDLPEventEmitter, testVideoPath }) {
  let progressDefined = false
  bcDLPEventEmitter.on('progress', (progressObject) => {
    if (
      progressObject.percent !== undefined &&
      progressObject.totalSize !== undefined &&
      progressObject.currentSpeed !== undefined &&
      progressObject.eta !== undefined
    ) { progressDefined = true }
  })

  let bcDLPEventFound = false

  bcDLPEventEmitter.on('ytDlpEvent', (eventType, eventData) => {
    if (eventType === 'youtube' && eventData.includes(testVideoId)) { bcDLPEventFound = true }
  })

  let waiterResolve
  const waiter = new Promise((resolve, reject) => { waiterResolve = resolve })

  bcDLPEventEmitter.on('error', (error) => { t.error(error, 'event emitter fail on error') })
  bcDLPEventEmitter.on('close', async () => {
    const stats = await stat(testVideoPath)
    t.ok(stats)
    await unlink(testVideoPath)
    t.ok(stats.size > 100, 'size is expected')
    t.ok(progressDefined, 'progress is defined')
    t.ok(bcDLPEventFound, '')
    waiterResolve()
  })

  await Promise.all([
    waiter,
    t.emits(bcDLPEventEmitter, 'progress'),
    t.emits(bcDLPEventEmitter, 'close')
  ])
}

async function checkReadableStream ({ t, bcDLPStream, execEventEmitter, testVideoPath, pipe }) {
  let progressDefined = false
  execEventEmitter.on('progress', (progressObject) => {
    if (
      progressObject.percent !== undefined &&
      progressObject.totalSize !== undefined &&
      progressObject.currentSpeed !== undefined &&
      progressObject.eta !== undefined
    ) { progressDefined = true }
  })

  let bcDLPEventFound = false
  execEventEmitter.on('ytDlpEvent', (eventType, eventData) => {
    if (eventType === 'youtube' && eventData.includes(testVideoId)) { bcDLPEventFound = true }
  })

  execEventEmitter.on('error', (error) => {
    t.error(error, 'errors not expected')
  })

  let waiterResolve
  const waiter = new Promise((resolve, reject) => { waiterResolve = resolve })

  bcDLPStream.on('close', async () => {
    const stats = await stat(testVideoPath)
    t.ok(stats, 'video exists')
    t.ok(stats.size > 100)
    t.ok(progressDefined, 'progress found')
    t.ok(bcDLPEventFound, 'bcDLPEvent found')
    await unlink(testVideoPath)
    waiterResolve()
  })

  await Promise.all([
    pipe,
    waiter,
    t.emits(execEventEmitter, 'progress'),
    t.emits(execEventEmitter, 'close'),
    t.emits(bcDLPStream, 'close')
  ])
}

function isValidVersion (version) {
  return !isNaN(Date.parse(version.substring(0, 10).replace(/\./g, '-')))
}
