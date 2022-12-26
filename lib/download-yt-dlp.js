import { Octokit } from 'octokit'
import assert from 'webassert'
import { resolve } from 'path'
import { request } from 'undici'
import { pipeline } from 'stream/promises'
import { createWriteStream } from 'fs'
import { chmod } from 'fs/promises'

function getAssetName (platform, arch) {
  assert(platform, 'platform required')
  assert(arch, 'arch required')

  if (platform === 'darwin') {
    // universal bin
    return 'yt-dlp_macos'
  }

  if (platform === 'win32') {
    if (arch === 'ia32') return 'yt-dlp_x86.exe'
    else return 'yt-dlp.exe'
  }

  // assume linux

  if (arch === 'arm') return 'yt-dlp_linux_armv7l'
  if (arch === 'arm64') return 'yt-dlp_linux_aarch64'

  return 'yt-dlp'
}

export async function downloadFromGithub ({
  filepath,
  assetName,
  tag,
  platform = process.platform,
  arch = process.arch,
  octokitOpts = {}
} = {}) {
  const octokit = new Octokit(octokitOpts)
  const owner = 'yt-dlp'
  const repo = 'yt-dlp'
  const isWin32 = platform === 'win32'
  assetName = assetName ?? getAssetName(platform, arch)
  const { data: release } = tag
    ? await octokit.rest.repos.getReleaseByTag({
      owner,
      repo,
      tag
    })
    : await octokit.rest.repos.getLatestRelease({
      owner,
      repo
    })

  if (!filepath) filepath = resolve(process.cwd(), assetName)
  if (isWin32 && !filepath.endsWith('.exe')) filepath = `${filepath}.exe`

  const asset = release.assets.find(asset => asset.name === assetName)
  assert(asset, `An asset must exist with the name of ${assetName}`)

  const { statusCode, body } = await request(asset.browser_download_url, { maxRedirections: 3 })
  if (statusCode <= 299) {
    await pipeline(
      body,
      createWriteStream(filepath)
    )

    if (!isWin32) await chmod(filepath, '777')
    return {
      binPath: filepath,
      tag: release.tag_name,
      assetName,
      platform,
      arch
    }
  } else {
    throw new Error(`Unexpected download response ${statusCode}: ${(await body.text()).substring(0, 5000)}`)
  }
}
