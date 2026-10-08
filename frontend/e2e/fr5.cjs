/* Real Chrome + real API regression. See docs/fr5/design-pattern-and-testing.md. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const base = process.env.SKOPIA_BASE_URL || 'http://localhost:8083'
const output = path.resolve(process.env.FR5_EVIDENCE_DIR || path.join(__dirname, '../../output/fr5-regression'))
const mediaDir = process.env.FR5_MEDIA_DIR || '/tmp/skopia-fr5-run'
fs.mkdirSync(output, { recursive: true })
const tag = `FR5-${Date.now()}`
const day = offset => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const from = day(-1), to = day(22), invalidEnd = day(-2), rangeFrom = day(-29), rangeTo = day(22)
const results = [], errors = [], pages = {}, sessions = {}, campaigns = {}
let browser, video, category, adMedia
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
async function api(url, token, method = 'GET', body) {
  const response = await fetch(base + url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const text = await response.text()
  assert(response.ok, `${method} ${url}: ${response.status} ${text}`)
  return text ? JSON.parse(text) : null
}
async function test(name, run) {
  const start = Date.now()
  try { const detail = await run(); results.push({ name, status: 'PASS', seconds: (Date.now() - start) / 1000, detail }); console.log('PASS', name, detail || '') }
  catch (error) { results.push({ name, status: 'FAIL', error: error.message }); console.error('FAIL', name, error.message) }
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ base, tag, results, browserErrors: errors }, null, 2))
}
async function shot(page, name) { await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true }) }
async function open(role, url) {
  if (!pages[role]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
    const page = await context.newPage(); page.setDefaultTimeout(12000)
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error' && /Cannot update|Maximum update|Uncaught/.test(m.text())) errors.push(m.text()) })
    page.on('dialog', d => d.accept())
    if (role !== 'guest') {
      await page.goto(base + '/login')
      await page.getByPlaceholder('you@example.com or @handle').fill(sessions[role].username)
      await page.locator('input[type=password]').fill(role === 'viewer' ? 'Fr5Test2026' : 'skopia')
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      await page.waitForURL(u => !u.pathname.endsWith('/login'))
    }
    pages[role] = page
  }
  await pages[role].goto(base + url)
  return pages[role]
}
async function prepare() {
  assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Use a local disposable test server')
  fs.mkdirSync(mediaDir, { recursive: true })
  if (!fs.existsSync(path.join(mediaDir, 'feature.mp4'))) require('node:child_process').execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=24',
    '-t', '24', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', path.join(mediaDir, 'feature.mp4'),
  ])
  if (!fs.existsSync(path.join(mediaDir, 'ad.png'))) fs.writeFileSync(path.join(mediaDir, 'ad.png'),
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1EAAAAASUVORK5CYII=', 'base64'))

  for (const [role, username] of Object.entries({ marketing: 'm.madhusara', admin: 'p.punsara', creator: 'meridian' })) sessions[role] = await api('/api/auth/login', null, 'POST', { identifier: username, password: 'skopia' })
  sessions.viewer = await api('/api/auth/register', null, 'POST', { username: 'fr5_' + Date.now(), email: tag + '@example.test', password: require('node:crypto').randomBytes(24).toString('hex'), firstName: 'FR5', lastName: 'Viewer' })
  category = (await api('/api/categories'))[0]
  const form = new FormData()
  form.append('title', tag + ' Feature'); form.append('categoryId', String(category.id)); form.append('accessType', 'FREE'); form.append('status', 'PUBLISHED'); form.append('durationSeconds', '24')
  form.append('videoFile', new Blob([fs.readFileSync(path.join(mediaDir, 'feature.mp4'))], { type: 'video/mp4' }), 'feature.mp4')
  form.append('thumbnailFile', new Blob([fs.readFileSync(path.join(mediaDir, 'ad.png'))], { type: 'image/png' }), 'feature.png')
  const response = await fetch(base + '/api/videos', { method: 'POST', headers: { Authorization: `Bearer ${sessions.creator.token}` }, body: form })
  assert(response.ok, await response.clone().text()); video = await response.json(); video = await api('/api/videos/' + video.id, sessions.creator.token)
}
async function wizard(slot, draft = false, file = 'ad.png', targetCategory = false) {
  const p = await open('marketing', '/campaigns/new')
  await p.getByPlaceholder('Autumn Season Launch').fill(tag + ' ' + slot)
  await p.getByPlaceholder('Who is this running for?').fill('FR5 Test Advertiser')
  await p.getByLabel(/Budget/).fill('100')
  await p.getByLabel(/Placement/).selectOption(slot)
  await p.getByRole('button', { name: 'Continue to creative' }).click()
  await p.locator('input[type=file]').setInputFiles(path.join(mediaDir, file))
  await p.getByText(file + ' uploaded', { exact: true }).waitFor()
  await p.getByLabel(/Promotional link/).fill('https://example.com/fr5')
  await p.getByRole('button', { name: 'Continue to targeting' }).click()
  await p.getByRole('button', { name: 'Continue to schedule' }).click()
  assert(await p.getByText('Choose at least one title or category to target.').isVisible())
  await p.getByRole('button', { name: targetCategory ? new RegExp('^' + category.name) : video.title, exact: !targetCategory }).click()
  await p.getByRole('button', { name: 'Continue to schedule' }).click()
  await p.getByLabel(/Start date/).fill(from)
  await p.getByLabel(/End date/).fill(invalidEnd)
  assert(await p.getByText('The end date must fall after the start date.').isVisible())
  await p.getByLabel(/End date/).fill(to)
  const createResponse = p.waitForResponse(r => r.url().endsWith('/api/ad-campaigns') && r.request().method() === 'POST')
  await p.getByRole('button', { name: draft ? 'Save draft' : 'Confirm campaign', exact: true }).click()
  const response = await createResponse; assert.equal(response.status(), 201)
  const campaign = await response.json()
  await p.getByRole('button', { name: 'Open the campaign' }).waitFor()
  if (draft) assert(await p.getByText(tag + ' ' + slot + ' is saved as a draft').isVisible())
  await shot(p, slot + '-created')
  await p.getByRole('button', { name: 'Open the campaign' }).click()
  await p.getByRole('heading', { name: campaign.campaignName, exact: true }).waitFor()
  const ads = await api('/api/advertisements?campaignId=' + campaign.id, sessions.marketing.token)
  campaigns[slot] = { ...campaign, ad: ads[0] }
  if (!adMedia) adMedia = ads[0].mediaUrl
  return campaign
}
async function skip(p, slot) {
  const region = p.locator(`[aria-label="${slot} advertisement"]`)
  await region.waitFor({ state: 'visible' })
  await shot(p, slot.replaceAll(' ', '-'))
  const button = region.getByRole('button', { name: 'Skip advertisement', exact: true })
  await button.waitFor({ state: 'visible' })
  await button.click()
  await region.waitFor({ state: 'hidden' })
}
(async () => {
  browser = await chromium.launch({ headless: process.env.FR5_HEADLESS === 'true', executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  await prepare()
  await test('FR5-TC01 role access', async () => {
    const p = await open('viewer', '/campaigns'); await p.getByText(/staff only|not allowed|not authorised|not authorized|not hold/i).first().waitFor()
    const admin = await open('admin', '/campaigns'); await admin.getByRole('heading', { name: /Campaigns/i }).first().waitFor()
    const officer = await open('marketing', '/campaigns'); await officer.getByRole('heading', { name: /Campaigns/i }).first().waitFor()
  })
  await test('FR5-TC02 draft + TC03 dates + TC04 image upload + TC06 title targeting', async () => {
    await wizard('PREROLL', true)
    const p = pages.marketing
    const c = await api('/api/ad-campaigns/' + campaigns.PREROLL.id, sessions.marketing.token)
    assert.equal(c.status, 'DRAFT'); assert.equal(c.createdById, sessions.marketing.id)
    assert.equal(campaigns.PREROLL.ad.status, 'DRAFT')
    await p.reload(); await p.getByRole('button', { name: 'Switch on', exact: true }).click()
    await p.getByRole('button', { name: 'Switch off', exact: true }).waitFor()
    await p.getByRole('button', { name: 'Confirm', exact: true }).click()
    await p.getByRole('button', { name: 'Pause', exact: true }).waitFor()
    await shot(p, 'draft-confirmed')
  })
  for (const slot of ['MIDROLL', 'POSTROLL', 'OVERLAY', 'LOBBY']) await test('Create ' + slot + ' through campaign wizard', () => wizard(slot, false, slot === 'MIDROLL' ? 'feature.mp4' : 'ad.png', slot === 'OVERLAY'))
  await test('FR5-TC05 rejected media uploads through browser', async () => {
    const p = await open('marketing', '/campaigns/new')
    await p.getByPlaceholder('Autumn Season Launch').fill(tag + ' Invalid'); await p.getByPlaceholder('Who is this running for?').fill('Test')
    await p.getByRole('button', { name: 'Continue to creative' }).click()
    for (const item of [
      { name: 'payload.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>'), message: /Accepted creative/ },
      { name: 'spoof.png', mimeType: 'application/x-sh', buffer: Buffer.from('#!/bin/sh'), message: /arrived as/ },
      { name: 'script.png', mimeType: 'image/png', buffer: Buffer.from('#!/bin/sh'), message: /file contents/ },
    ]) {
      await p.locator('input[type=file]').setInputFiles({ name: item.name, mimeType: item.mimeType, buffer: item.buffer })
      await p.getByText(item.message).first().waitFor()
    }
    const oversized = path.join(mediaDir, 'oversized.mp4')
    fs.writeFileSync(oversized, Buffer.alloc(52428801))
    await p.locator('input[type=file]').setInputFiles(oversized)
    await p.getByText(/The limit is/).first().waitFor()
    await shot(p, 'rejected-media')
  })
  await test('FR5-TC06 malformed/duplicate target API safeguards', async () => {
    const ad = campaigns.PREROLL.ad
    for (const body of [ { videoId: video.id, categoryId: category.id, slotPosition: 'PREROLL' }, { slotPosition: 'PREROLL' }, { videoId: video.id, slotPosition: 'PREROLL' } ]) {
      const r = await fetch(base + `/api/advertisements/${ad.id}/targets`, { method: 'POST', headers: { Authorization: `Bearer ${sessions.marketing.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      assert([400, 409].includes(r.status), 'Malformed/duplicate target was accepted')
    }
    return 'UI rejects empty targets; API verifies both/neither and duplicate requests unavailable in ordinary UI.'
  })
  await test('All five positions render during real feature playback, tracking + skip + resume + postroll', async () => {
    const p = await open('guest', '/watch/' + video.id)
    const tracked = []
    p.on('response', async r => { if (r.url().includes('/api/ads/active') && r.ok()) { try { tracked.push(...await r.json()) } catch {} } })
    const pre = p.locator('[aria-label="Pre-roll advertisement"]'); await pre.waitFor({ state: 'visible' })
    assert(await pre.getByRole('button', { name: /Skip in/ }).isDisabled())
    const popupEvent = p.waitForEvent('popup'); await pre.getByRole('link', { name: 'Find out more' }).click()
    const popup = await popupEvent; await popup.waitForURL(/example.com\/fr5/); await popup.close()
    await skip(p, 'Pre-roll')
    await p.locator('[aria-label="Lobby standee advertisement"]').waitFor({ state: 'visible' }); await shot(p, 'lobby-outside-player')
    await p.getByRole('button', { name: 'Play', exact: true }).first().click()
    const feature = p.locator('[data-ad-playback] video').first()
    await p.getByRole('button', { name: 'Full screen', exact: true }).click()
    await p.waitForFunction(() => !!document.fullscreenElement)
    await p.locator('[aria-label="Overlay advertisement"]').waitFor({ state: 'visible' }); assert.equal(await feature.evaluate(e => e.paused), false); await shot(p, 'overlay-continuing-playback')
    await p.locator('[aria-label="Mid-roll advertisement"]').waitFor({ state: 'visible' })
    assert(await p.evaluate(() => document.fullscreenElement.contains(document.querySelector('[aria-label="Mid-roll advertisement"]'))))
    const pausedAt = await feature.evaluate(e => e.currentTime); assert(pausedAt >= 12); assert.equal(await feature.evaluate(e => e.paused), true)
    await wait(1000); assert(Math.abs(await feature.evaluate(e => e.currentTime) - pausedAt) < 0.2)
    await skip(p, 'Mid-roll')
    await p.waitForFunction(() => { const v = document.querySelector('video'); return v && !v.paused })
    assert(await feature.evaluate(e => e.currentTime) >= pausedAt)
    // A normal seek shortcut reaches feature end without waiting for the full clip.
    await p.keyboard.press('9'); await p.keyboard.press('ArrowRight')
    await skip(p, 'Post-roll')
    await p.keyboard.press('Escape')
    assert(tracked.some(a => a.slotPosition === 'MIDROLL'))
    assert(tracked.some(a => a.slotPosition === 'POSTROLL'))
    assert.equal(tracked.filter(a => a.slotPosition === 'OVERLAY').length, 1)
    assert(tracked.some(a => a.slotPosition === 'LOBBY'))
    return { pausedAt, positions: [...new Set(tracked.map(a => a.slotPosition))] }
  })
  await test('FR5-TC07 pause/resume + TC08 inactive suppression in viewer browser', async () => {
    const p = await open('marketing', '/campaigns/' + campaigns.PREROLL.id)
    await p.getByRole('button', { name: 'Pause', exact: true }).click(); await p.getByRole('button', { name: 'Resume', exact: true }).waitFor()
    const viewer = await open('viewer', '/watch/' + video.id); await viewer.getByRole('button', { name: 'Play', exact: true }).first().waitFor()
    assert.equal(await viewer.locator('[aria-label="Pre-roll advertisement"]').count(), 0)
    await p.getByRole('button', { name: 'Resume', exact: true }).click(); await p.getByRole('button', { name: 'Pause', exact: true }).waitFor()
    await viewer.reload(); await viewer.locator('[aria-label="Pre-roll advertisement"]').waitFor({ state: 'visible' })
    await p.getByRole('button', { name: 'Switch off', exact: true }).click(); await p.getByRole('button', { name: 'Switch on', exact: true }).waitFor()
    await viewer.reload(); await viewer.getByRole('button', { name: 'Play', exact: true }).first().waitFor()
    assert.equal(await viewer.locator('[aria-label="Pre-roll advertisement"]').count(), 0)
    await p.getByRole('button', { name: 'Switch on', exact: true }).click(); await p.getByRole('button', { name: 'Switch off', exact: true }).waitFor()
  })
  await test('FR5-TC09 idempotent click totals + TC10 CSV download and date filtering', async () => {
    const served = await api(`/api/ads/active?videoId=${video.id}&slot=PREROLL`)
    assert.equal(served.length, 1)
    await api(`/api/ads/click/${served[0].impressionId}`, null, 'POST')
    const before = await api(`/api/ad-campaigns/${campaigns.PREROLL.id}/metrics`, sessions.marketing.token)
    await api(`/api/ads/click/${served[0].impressionId}`, null, 'POST')
    const after = await api(`/api/ad-campaigns/${campaigns.PREROLL.id}/metrics`, sessions.marketing.token)
    assert.equal(before.clicks, after.clicks)
    const p = await open('marketing', '/campaigns/performance')
    await p.getByLabel('From date', { exact: true }).fill(rangeFrom); await p.getByLabel('To date', { exact: true }).fill(to)
    await p.getByRole('button', { name: 'Apply date range' }).click()
    let row = p.locator('tbody tr').filter({ hasText: tag + ' PREROLL' }); await row.waitFor()
    const text = await row.innerText(); assert(text.includes(String(after.clicks)))
    const downloadEvent = p.waitForEvent('download'); await row.getByRole('button', { name: 'CSV', exact: true }).click()
    const download = await downloadEvent; assert.equal(await download.failure(), null)
    await download.saveAs(path.join(output, 'campaign.csv')); const csv = fs.readFileSync(path.join(output, 'campaign.csv'), 'utf8'); assert(csv.includes('Impressions,' + after.impressions)); assert(csv.includes('Clicks,' + after.clicks)); assert(csv.includes('CTR %,' + after.ctr)); assert(csv.includes(day(0)))
    await shot(p, 'performance-csv')
    await p.getByLabel('From date', { exact: true }).fill('2020-01-01'); await p.getByLabel('To date', { exact: true }).fill('2020-01-02')
    await p.getByRole('button', { name: 'Apply date range' }).click(); await p.getByText('Showing 2020-01-01 to 2020-01-02, inclusive. CSV uses the same range.').waitFor()
    row = p.locator('tbody tr').filter({ hasText: tag + ' PREROLL' }); if (await row.count()) assert((await row.innerText()).includes('0.00%'), 'Previous date-range totals remained visible'); await p.waitForFunction((name) => { const row = [...document.querySelectorAll('tbody tr')].find(r => r.textContent.includes(name)); return row && row.textContent.includes('0.00%') }, tag + ' PREROLL')
    const invalidFrom = p.getByLabel('From date', { exact: true }); await invalidFrom.fill('2021-01-01'); await p.getByRole('button', { name: 'Apply date range' }).click(); assert(await p.getByRole('alert').filter({ hasText: 'Choose a start date' }).isVisible())
    await shot(p, 'empty-range-and-invalid-range')
    return { impressions: after.impressions, clicks: after.clicks, ctr: after.ctr, downloadedBytes: csv.length }
  })
  await test('Edit creative and retarget a placement without losing its identity', async () => {
    const p = await open('marketing', '/campaigns/' + campaigns.LOBBY.id)
    await p.getByRole('button', { name: 'Edit', exact: true }).click()
    let dialog = p.getByRole('dialog')
    await dialog.getByLabel(/Advertisement title/).fill(tag + ' Updated standee')
    await dialog.getByRole('button', { name: /Save/ }).click()
    await dialog.waitFor({ state: 'hidden' })
    await p.getByText(tag + ' Updated standee', { exact: true }).first().waitFor()
    await p.getByRole('button', { name: 'Edit the ' + video.title + ' placement', exact: true }).click()
    dialog = p.getByRole('dialog')
    await dialog.getByLabel(/Priority/).fill('9')
    await dialog.getByRole('button', { name: 'Save placement', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    const ad = await api('/api/advertisements/' + campaigns.LOBBY.ad.id, sessions.marketing.token)
    assert.equal(ad.adTitle, tag + ' Updated standee')
    assert.equal(ad.placements[0].id, campaigns.LOBBY.ad.placements[0].id)
    assert.equal(ad.placements[0].priority, 9)
    await shot(p, 'edited-creative-and-placement')
    await p.getByRole('button', { name: 'Add target', exact: true }).click()
    dialog = p.getByRole('dialog')
    assert.equal(await dialog.getByRole('button', { name: video.title, exact: true }).count(), 0)
    await dialog.getByRole('button', { name: new RegExp('^' + category.name) }).click()
    await dialog.getByRole('button', { name: 'Add target', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await p.getByRole('button', { name: 'Stop targeting ' + category.name, exact: true }).click()
    await p.getByRole('button', { name: 'Stop targeting ' + category.name, exact: true }).waitFor({ state: 'hidden' })
    const targets = await api('/api/advertisements/' + campaigns.LOBBY.ad.id + '/targets', sessions.marketing.token)
    assert.equal(targets.length, 1)
    return 'Creative edit, priority edit, duplicate exclusion, target add and target removal persisted.'
  })
  await test('Automatic ad completion and campaign search', async () => {
    const p = await open('guest', '/watch/' + video.id)
    await p.locator('[aria-label="Pre-roll advertisement"]').waitFor({ state: 'visible' })
    await p.getByRole('button', { name: 'Play', exact: true }).first().waitFor()
    assert.equal(await p.locator('[aria-label="Pre-roll advertisement"]').count(), 0)
    const officer = await open('marketing', '/campaigns')
    await officer.getByPlaceholder('Find a campaign').fill(tag)
    await officer.locator('tbody tr').first().waitFor()
    await officer.getByPlaceholder('Find a campaign').fill(tag + '-no-match')
    await officer.getByText(/No campaigns|Nothing matches|No matching|Nothing in this view/i).first().waitFor()
  })
  await test('Serving outage and broken creative fail open to feature playback', async () => {
    const p = pages.guest
    await p.route('**/api/ads/active?**', route => route.abort('failed'))
    await p.goto(base + '/watch/' + video.id)
    await p.getByRole('button', { name: 'Play', exact: true }).first().waitFor()
    assert.equal(await p.locator('[aria-label$=" advertisement"]').count(), 0)
    await p.unroute('**/api/ads/active?**')
    await p.route('**/uploads/ads/**', route => route.abort('failed'))
    await p.reload()
    await p.getByRole('button', { name: 'Play', exact: true }).first().waitFor()
    await p.unroute('**/uploads/ads/**')
    return 'Network fault simulation only; campaign and serving tests otherwise use real responses.'
  })
  await test('Campaign edit schedule, expiry and archive through browser', async () => {
    const p = await open('marketing', '/campaigns/' + campaigns.PREROLL.id)
    await p.getByRole('button', { name: 'Edit details', exact: true }).click()
    const dialog = p.getByRole('dialog')
    await dialog.getByLabel(/Starts/).fill(day(-60))
    await dialog.getByLabel(/Ends/).fill(day(-59))
    await dialog.getByRole('button', { name: /Save/ }).click()
    await dialog.waitFor({ state: 'hidden' })
    await p.getByText('This campaign ended on', { exact: false }).waitFor()
    const viewer = await open('guest', '/watch/' + video.id)
    await viewer.getByRole('button', { name: 'Play', exact: true }).first().waitFor()
    assert.equal(await viewer.locator('[aria-label="Pre-roll advertisement"]').count(), 0)
    await p.getByRole('button', { name: 'Archive', exact: true }).click()
    await p.getByRole('dialog').getByRole('button', { name: /Archive/ }).click()
    await p.getByRole('dialog').waitFor({ state: 'hidden' })
    assert.equal((await api('/api/ad-campaigns/' + campaigns.PREROLL.id, sessions.marketing.token)).status, 'ARCHIVED')
    await shot(p, 'expired-archived-campaign')
  })
  await test('Ad-free subscription through viewer checkout suppresses all positions', async () => {
    const p = await open('viewer', '/checkout?plan=MONTHLY')
    await p.getByRole('button', { name: 'Use test card' }).click()
    await p.getByPlaceholder('12/99').fill('12/99')
    await p.getByPlaceholder('Demo Viewer').fill('Test Viewer')
    await p.getByRole('button', { name: /activate/i }).click()
    await p.waitForURL('**/checkout/result')
    await shot(p, 'ad-free-checkout')
    const requests = []
    p.on('response', async r => { if (r.url().includes('/api/ads/active') && r.ok()) { try { requests.push({ slot: new URL(r.url()).searchParams.get('slot'), body: await r.json() }) } catch {} } })
    await p.goto(base + '/watch/' + video.id)
    await p.getByRole('button', { name: 'Play', exact: true }).first().waitFor()
    await p.getByRole('button', { name: 'Play', exact: true }).first().click()
    await p.keyboard.press('7')
    await wait(1500)
    await p.keyboard.press('9'); await p.keyboard.press('ArrowRight')
    await wait(1000)
    assert.equal(await p.locator('[aria-label$=" advertisement"]').count(), 0)
    assert(requests.every(r => r.body.length === 0))
    for (const slot of ['PREROLL', 'MIDROLL', 'POSTROLL', 'OVERLAY', 'LOBBY']) {
      assert.equal((await api(`/api/ads/active?videoId=${video.id}&slot=${slot}`, sessions.viewer.token)).length, 0)
    }
    return requests.map(r => r.slot)
  })
  await test('Mobile watch and campaign layout', async () => {
    const p = await open('guest', '/watch/' + video.id); await p.setViewportSize({ width: 390, height: 844 }); await p.locator('[aria-label="Lobby standee advertisement"]').waitFor({ state: 'visible' }); await shot(p, 'mobile-lobby')
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2))
    const officer = await open('marketing', '/campaigns'); await officer.setViewportSize({ width: 390, height: 844 }); await officer.getByRole('heading', { name: /Campaigns/i }).first().waitFor(); await shot(officer, 'mobile-campaigns')
  })
  await test('Browser runtime errors', () => { assert.deepEqual(errors, []); return 'No uncaught JavaScript or React update errors.' })
  await browser.close()
  assert(results.every(r => r.status === 'PASS'), 'Some browser regressions failed; see results.json')
})().catch(async e => { console.error(e); if (browser) await browser.close(); process.exitCode = 1 })
