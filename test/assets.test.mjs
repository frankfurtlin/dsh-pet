/**
 * /pet/assets 直供的纯逻辑测试：解析、白名单、ETag、体积闸门。
 *
 * 路由本身很薄（读文件 + 头部），出错面都在 resolveAsset/readAsset 里，
 * 所以这里直接对模块断言，不启动 HTTP 服务。
 */

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { AssetError, ASSET_MIME, listAssets, MAX_ASSET_BYTES, readAsset, resolveAsset } from '../lib/assets.mjs'

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'dsh-pet-assets-'))
  writeFileSync(join(root, 'anim-cheer.webm'), Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
  writeFileSync(join(root, 'lulu.webp'), Buffer.from('RIFFxxxxWEBP'))
  writeFileSync(join(root, 'README.txt'), Buffer.from('not an asset'))
  return root
}

test('resolveAsset：合法名字返回 mime / 体积 / ETag', () => {
  const root = makeRoot()
  try {
    const webm = resolveAsset(root, 'anim-cheer.webm')
    assert.equal(webm.name, 'anim-cheer.webm')
    assert.equal(webm.mime, ASSET_MIME.webm)
    assert.equal(webm.size, 4)
    assert.match(webm.etag, /^"[0-9a-f]+-[0-9a-f]+"$/, 'ETag 由体积 + mtime 组成')
    assert.equal(resolveAsset(root, 'lulu.webp').mime, 'image/webp')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('resolveAsset：路径穿越 / 未知扩展名 / 不存在的文件都要拒绝', () => {
  const root = makeRoot()
  try {
    for (const bad of ['../package.json', '..%2Fpackage.json', 'sub/anim-cheer.webm', '/etc/passwd', 'anim.sh', 'README.txt', '']) {
      assert.throws(() => resolveAsset(root, bad), (error) => error instanceof AssetError && (error.code === 'BAD_NAME' || error.code === 'NOT_FOUND'), `${bad} 应被拒绝`)
    }
    assert.throws(() => resolveAsset(root, 'nope.webm'), (error) => error.code === 'NOT_FOUND')
    assert.throws(() => resolveAsset(root, 'dir'), (error) => error.code === 'BAD_NAME', '没有扩展名的目录不算素材')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('readAsset：读出字节；listAssets 只列白名单文件名', () => {
  const root = makeRoot()
  try {
    const asset = readAsset(root, 'anim-cheer.webm')
    assert.equal(asset.bytes.byteLength, 4)
    assert.equal(asset.bytes[0], 0x1a, '必须原样返回文件内容')
    assert.deepEqual(listAssets(root), ['anim-cheer.webm', 'lulu.webp'], 'README.txt 之类的非素材文件不列出来')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('readAsset：超过体积闸门的素材要拒绝（防止误放大文件进仓库白名单）', () => {
  const root = makeRoot()
  try {
    writeFileSync(join(root, 'huge.webp'), Buffer.alloc(MAX_ASSET_BYTES + 1))
    assert.throws(() => readAsset(root, 'huge.webp'), (error) => error.code === 'TOO_LARGE')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('listAssets：目录不存在时返回空数组（不抛错）', () => {
  assert.deepEqual(listAssets('/nonexistent/dsh-pet-assets'), [])
})
