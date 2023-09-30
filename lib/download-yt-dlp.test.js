import tmp from 'p-temporary-directory'
import tap from 'tap'
import { join } from 'path'
import { stat } from 'fs/promises'

import { downloadFromGithub } from './download-yt-dlp.js'

const token = process?.env?.GITHUB_TOKEN

tap.test('download yt-dlp', async t => {
  const [dir, cleanup] = await tmp()
  t.ok(dir, 'test dir created')
  try {
    const filepath = join(dir, 'yt-dlp')
    const octokitOpts = token ? { auth: token } : null
    const results = await downloadFromGithub({
      filepath,
      octokitOpts
    })
    t.ok(await stat(results.binPath))
  } finally {
    await cleanup()
    t.ok(dir, 'test dir cleaned up')
  }
})

tap.test('download yt-dlp at a specific tag', async t => {
  const [dir, cleanup] = await tmp()
  t.ok(dir, 'test dir created')
  try {
    const tag = '2022.08.08'
    const filepath = join(dir, 'yt-dlp')
    const octokitOpts = token ? { auth: token } : null
    const results = await downloadFromGithub({
      filepath,
      octokitOpts,
      tag: '2022.08.08'
    })
    t.ok(await stat(results.binPath))
    t.equal(results.tag, tag, 'downloaded the right tag')
  } finally {
    await cleanup()
    t.ok(dir, 'test dir cleaned up')
  }
})
