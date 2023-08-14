# bc-dlp
[![Actions Status](https://github.com/hifiwi-fi/bc-dlp/workflows/tests/badge.svg)](https://github.com/hifiwi-fi/bc-dlp/actions)
[![Coverage Status](https://coveralls.io/repos/github/hifiwi-fi/bc-dlp/badge.svg?branch=master)](https://coveralls.io/github/hifiwi-fi/bc-dlp?branch=master)

A yt-dlp wrapper with a few utilities for downloading the latest release.

A simple node.js wrapper for [yt-dlp](https://github.com/yt-dlp/yt-dlp) for use with [breadcrum.net](https://breadcrum.net).

- Has a few dependencies
- EventEmitter, Promise and Stream interface
- Working Progress events
- Utility functions
- Migrated to real esm. Not backwards compatible with CJS require (use import).
- ~~Typescript Support~~ Maybe typescript-in-js support someday. PRs welcome.

The interfaces may change a bit as things evolve here.

## Installation

```console
$ npm install bc-dlp
```

## Usage

### EventEmitter

Excecute yt-dlp and returns an [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter).
The `ytDlpEvent` event will expose all yt-dlp events, for example:
The log message `[download] Destination: output.mp4` will emit the event type `download` and the event data `Destination: output.mp4`.
`eventEmitter.child` exposes the spawned yt-dlp process.

```js
import { BcDLP } from 'bc-dlp'
const bcDLP = new BcDLP('yt-dlp') // If its in your process path

const eventEmitter = bcDLP
  .exec([
    'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    '-f',
    'best',
    '-o',
    'output.mp4'
  ])
  .on('progress', (progress) =>
    console.log(
      progress.percent,
      progress.totalSize,
      progress.currentSpeed,
      progress.eta
    )
  )
  .on('ytDlpEvent', (eventType, eventData) =>
    console.log(eventType, eventData)
  )
  .on('error', (error) => console.error(error))
  .on('close', () => console.log('all done'))

console.log(eventEmitter.child.pid)
```

### Readable Stream

Excecute yt-dlp and returns an [Readable Stream](https://nodejs.org/api/stream.html#stream_class_stream_readable).
The interface works just like the [EventEmitter](#EventEmitter).

```javascript
import { BcDLP } from 'bc-dlp'
import * as fs from 'fs'
const bcDLP = new BcDLP('yt-dlp')

const { readStream, execEventEmitter } = bcDLP.execStream([
  'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  '-f',
  'best[ext=mp4]'
])
readableStream.pipe(fs.createWriteStream('test.mp4'))
console.log(execEventEmitter.child.pid)
```

### Promise

Excecute yt-dlp and returns an [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise).

```javascript
const stdout = await bcDLP.execPromise([
  'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  '-f',
  'best',
  '-o',
  'output.mp4'
])
console.log(stdout)
```

### Options and Cancellation

Additionally you can set the options of the spawned process and abort the process.  
The abortion of the spawned process is handled by passing the signal of an [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController).

```javascript
const controller = new AbortController();
const eventEmitter = bcDLP.exec(
  [
    'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    '-f',
    'best',
    '-o',
    'output.mp4'
  ],
  { shell: true, detached: true, signal: controller.signal }
)

setTimeout(() => {
  controller.abort()
  console.log(eventEmitter.ytDlpProcess.killed) // true
}, 500)
```

**Note:** This fails crashes V8 with `bcDLP.execPromise` for some reason. 

### Metadata

Returns the yt-dlp `--dump-json` metadata as an object.

```javascript
const metadata = await bcDLP.getVideoInfo(
  'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
)
console.log(metadata.title)
```

### Utility functions

Just a few utility functions to get informations.

```javascript
const version = await bcDLP.getVersion()
const userAgent = await bcDLP.getUserAgent()
const help = await bcDLP.getHelp()
const extractors = await bcDLP.getExtractors()
const extractorDescriptions = await bcDLP.getExtractorDescriptions()
```

## See also

This is re-write of [foxesdocode/yt-dlp-wrap](https://github.com/foxesdocode/yt-dlp-wrap#readme) which is in turn a fork of [youtube-dl-wrap](https://github.com/ghjbnm/youtube-dl-wrap). They were both well done modules, but some things were broken and extra flexability was needed for breadcrum.net.

## License

MIT
