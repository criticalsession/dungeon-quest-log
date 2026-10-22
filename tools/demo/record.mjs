// Records a scripted demo of the quest log with Supabase faked in the page.
// Output: frames/*.jpg + frames.json (timestamps) + events.json (clicks/keys for the sound track).
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const OUT = path.resolve('out')
const FRAMES = path.join(OUT, 'frames')
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(FRAMES, { recursive: true })

const APP = 'http://localhost:4173/'
const W = 1920, H = 1080
const ME = 'Thalia'

// ── Fake database ─────────────────────────────────────────────────────────
const now = Date.now()
const ago = (days) => new Date(now - days * 86400_000).toISOString()
let nextNumber = 1
const quests = {}
const locks = {}
function seed(q) {
  const id = crypto.randomUUID()
  quests[id] = {
    id, quest_number: nextNumber++, archived: false, version: 1,
    quest_giver: null, location_received: null, quest_location: null, date_received: null, session_number: null,
    created_at: ago(q.age), updated_at: ago(q.age - 0.5), created_by_name: q.by, updated_by_name: q.by,
    ...q,
  }
  delete quests[id].age; delete quests[id].by
  return id
}
const p = (...xs) => xs.map((x) => `<p>${x}</p>`).join('')
const Q = {
  bandit: seed({ title: 'The Bandit King of Greymarch', status: 'fulfilled', archived: true, session_number: 1, date_received: '2026-07-04', quest_giver: 'Captain Hesk', location_received: 'Greymarch Keep', quest_location: 'The Greymarch hills', by: 'Borin', age: 100,
    description: p('Hesk wants the self-styled Bandit King brought in alive. He was not, in the end, brought in alive.') }),
  caravan: seed({ title: 'The Missing Caravan', status: 'active', session_number: 1, date_received: '2026-07-04', quest_giver: 'Guildmistress Orsa', location_received: 'Amael market', quest_location: 'Thornwood Road', by: 'Kestrel', age: 98,
    description: p('Three wagons of Orsan silk left Amael for Brightwater and never arrived. Orsa offers <strong>150 gold</strong> for the cargo and twice that for news of her nephew, who rode with it.', 'Wheel ruts leave the road near the old waystone and head into the Thornwood.') }),
  rats: seed({ title: 'Rats in the Cellar', status: 'fulfilled', session_number: 1, date_received: '2026-07-04', quest_giver: 'Bram the innkeeper', location_received: 'The Gilded Goose', quest_location: 'Cellar of the Gilded Goose', by: 'Mira', age: 97,
    description: p('Bram swears the rats are the size of dogs. They were the size of ponies. Paid in ale, for life (Bram’s life).') }),
  pilgrims: seed({ title: 'Escort the Pilgrims to Saint Aldric’s Shrine', status: 'on_hold', session_number: 2, date_received: '2026-07-18', quest_giver: 'Sister Maren', location_received: 'Temple of the Dawn', quest_location: 'Saint Aldric’s Shrine', by: 'Thalia', age: 84,
    description: p('Twelve pilgrims, one mule, and a very long road. Waiting until the passes are clear of snow.') }),
  lute: seed({ title: 'Recover the Dragonbone Lute', status: 'fulfilled', session_number: 2, date_received: '2026-07-18', quest_giver: 'Lord Fenwick', location_received: 'Fenwick Manor', quest_location: 'Barrow of the Singing King', by: 'Kestrel', age: 83,
    description: p('Returned to Lord Fenwick. He still cannot play it.') }),
  lich: seed({ title: 'The Lich’s Phylactery', status: 'active', session_number: 3, date_received: '2026-08-01', quest_giver: 'The Oracle of Vel', location_received: 'The Pale Tower', quest_location: 'Sunken Crypt of Mor', by: 'Borin', age: 70,
    description: p('The Oracle spoke of a heart kept in a box of black iron, guarded by <em>those who drowned keeping it</em>. Until the phylactery is destroyed, Vaskar the Undying will rise again.', 'Known so far:') + '<ul><li>The crypt floods at high tide.</li><li>The box can only be opened by moonlight.</li><li>Borin owes the Oracle a favour now. Nobody asked what.</li></ul>' }),
  guild: seed({ title: 'A Debt to the Thieves’ Guild', status: 'active', session_number: 4, date_received: '2026-08-15', quest_giver: 'Whisper', location_received: 'The Rookery', quest_location: 'Amael docks', by: 'Mira', age: 56,
    description: p('Mira’s cousin owes the Guild 400 gold. Whisper will forget the debt if the party “retrieves” a ledger from the harbourmaster’s office.') }),
  daughter: seed({ title: 'Find the Cartographer’s Daughter', status: 'on_hold', session_number: 4, date_received: '2026-08-15', quest_giver: 'Old Tobias', location_received: 'Amael library', quest_location: 'The Glass Marshes', by: 'Thalia', age: 55,
    description: p('Tobias’s daughter went to map the Glass Marshes and has not written in a month. On hold until we have a guide.') }),
  grove: seed({ title: 'Cleanse the Blighted Grove', status: 'active', session_number: 5, date_received: '2026-08-29', quest_giver: 'Elowen of the Circle', location_received: 'Thornwood edge', quest_location: 'The Heartwood', by: 'Kestrel', age: 42,
    description: p('Something is rotting the oldest trees from the roots up. Elowen thinks it is a curse. Borin thinks it is beetles.') }),
}

function rpc(fn, a) {
  const touch = (q, extra) => {
    Object.assign(q, extra, { version: q.version + 1, updated_at: new Date().toISOString(), updated_by_name: a.p_author })
    return q
  }
  const fields = (a) => ({
    title: a.p_title, description: a.p_description, date_received: a.p_date_received, session_number: a.p_session_number,
    quest_giver: a.p_quest_giver || null, location_received: a.p_location_received || null, quest_location: a.p_quest_location || null,
  })
  switch (fn) {
    case 'create_quest': {
      const id = crypto.randomUUID()
      const t = new Date().toISOString()
      quests[id] = { id, quest_number: nextNumber++, status: 'active', archived: false, version: 1, created_at: t, updated_at: t, created_by_name: a.p_author, updated_by_name: a.p_author, ...fields(a) }
      return quests[id]
    }
    case 'save_quest': delete locks[a.p_quest_id]; return touch(quests[a.p_quest_id], fields(a))
    case 'set_status': return touch(quests[a.p_quest_id], { status: a.p_status })
    case 'set_archived': return touch(quests[a.p_quest_id], { archived: a.p_archived })
    case 'acquire_lock': {
      const t = Date.now()
      locks[a.p_quest_id] = { quest_id: a.p_quest_id, client_id: a.p_client_id, holder_name: a.p_name, acquired_at: new Date(t).toISOString(), expires_at: new Date(t + 120_000).toISOString() }
      return undefined
    }
    case 'release_lock': delete locks[a.p_quest_id]; return undefined
    case 'heartbeat_lock': return true
    default: return undefined
  }
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(now / 1000) + 3600 * 6
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'demo-user', role: 'authenticated', aud: 'authenticated', exp, email: 'party@example.com' })}.c2lnbmF0dXJl`
const user = { id: 'demo-user', aud: 'authenticated', role: 'authenticated', email: 'party@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: ago(120) }

// ── Browser ───────────────────────────────────────────────────────────────
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'Europe/London' })

// Every request to Supabase is answered here; nothing reaches the real project.
await context.route(/supabase\.co/, async (route) => {
  const req = route.request()
  const url = new URL(req.url())
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  if (url.pathname.startsWith('/auth/v1/token')) return json({ access_token: jwt, token_type: 'bearer', expires_in: 21600, expires_at: exp, refresh_token: 'demo-refresh', user })
  if (url.pathname.startsWith('/auth/v1/logout')) return route.fulfill({ status: 204 })
  if (url.pathname.startsWith('/auth/v1/user')) return json(user)
  if (url.pathname === '/rest/v1/quests') return json(Object.values(quests))
  if (url.pathname === '/rest/v1/quest_locks') return json(Object.values(locks))
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const fn = url.pathname.split('/').pop()
    const result = rpc(fn, JSON.parse(req.postData() || '{}'))
    return result === undefined ? route.fulfill({ status: 204 }) : json(result)
  }
  console.log('blocked', req.method(), url.pathname)
  return route.abort()
})

// Fake realtime server (protocol vsn 2.0.0: [join_ref, ref, topic, event, payload]).
let rt = null
await context.routeWebSocket(/realtime\/v1\/websocket/, (ws) => {
  ws.onMessage((raw) => {
    const [joinRef, ref, topic, event] = JSON.parse(raw)
    const reply = (response) => ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response }]))
    if (event === 'phx_join') {
      rt = { ws, joinRef, topic }
      reply({ postgres_changes: [{ id: 11, event: '*', schema: 'public', table: 'quests' }, { id: 12, event: '*', schema: 'public', table: 'quest_locks' }] })
    } else if (event === 'heartbeat' || event === 'phx_leave') reply({})
  })
})
function pushChange(table, type, record, old = null) {
  const id = table === 'quests' ? 11 : 12
  rt.ws.send(JSON.stringify([rt.joinRef, null, rt.topic, 'postgres_changes', {
    ids: [id], data: { schema: 'public', table, commit_timestamp: new Date().toISOString(), type, columns: [], record, old_record: old, errors: null },
  }]))
}

// Demo overlay: cursor, captions, title cards. Lives outside the app's own DOM tree.
await context.addInitScript(() => {
  const css = `
  #demo-cursor{position:fixed;left:0;top:0;width:30px;height:38px;z-index:2147483647;pointer-events:none;transform:translate(960px,540px);filter:drop-shadow(1px 2px 2px rgba(0,0,0,.55))}
  #demo-cursor svg{transition:transform .08s}
  #demo-cursor.down svg{transform:scale(.86)}
  .demo-ring{position:fixed;width:36px;height:36px;margin:-18px 0 0 -18px;border:3px solid rgba(255,214,140,.95);border-radius:50%;z-index:2147483646;pointer-events:none;animation:demo-ring .45s ease-out forwards}
  @keyframes demo-ring{from{transform:scale(.3);opacity:1}to{transform:scale(1.5);opacity:0}}
  #demo-caption{position:fixed;left:50%;bottom:26px;transform:translate(-50%,12px);opacity:0;z-index:2147483640;pointer-events:none;
    background:rgba(28,17,10,.88);color:#f4e7c9;border:1px solid rgba(214,170,96,.7);border-radius:6px;padding:12px 30px 13px;
    font-family:var(--font-body),Georgia,serif;font-size:30px;letter-spacing:.01em;white-space:nowrap;box-shadow:0 6px 24px rgba(0,0,0,.5);transition:opacity .45s,transform .45s}
  #demo-caption.on{opacity:1;transform:translate(-50%,0)}
  #demo-card{position:fixed;inset:0;z-index:2147483645;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
    background:radial-gradient(ellipse at center,rgba(20,12,6,.55),rgba(8,4,2,.92)),url('/images/tome-table.webp') center/cover;color:#f4e7c9;text-align:center;transition:opacity 1s;opacity:0;pointer-events:none}
  #demo-card.on{opacity:1}
  #demo-card h1{font-family:var(--font-title),serif;font-size:140px;font-weight:normal;margin:0;color:#f0d9a6;text-shadow:0 4px 18px rgba(0,0,0,.8)}
  #demo-card p{font-family:var(--font-body),serif;font-size:40px;margin:0;opacity:.92;text-shadow:0 2px 10px rgba(0,0,0,.9)}
  #demo-card .small{font-size:30px;opacity:.8;margin-top:26px}
  #demo-card .rule{width:420px;height:2px;margin:8px 0 14px;background:linear-gradient(90deg,transparent,#c9a25a,transparent)}`
  const init = () => {
    if (document.getElementById('demo-cursor')) return
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style)
    const c = document.createElement('div'); c.id = 'demo-cursor'
    c.innerHTML = '<svg width="30" height="38" viewBox="0 0 30 38"><path d="M2 2 L2 30 L9 23.5 L14 35 L19 32.8 L14 21.5 L24 21.5 Z" fill="#fff8ea" stroke="#2a180c" stroke-width="2.2" stroke-linejoin="round"/></svg>'
    document.body.appendChild(c)
    const cap = document.createElement('div'); cap.id = 'demo-caption'; document.body.appendChild(cap)
    const card = document.createElement('div'); card.id = 'demo-card'; document.body.appendChild(card)
    addEventListener('mousemove', (e) => { c.style.transform = `translate(${e.clientX - 2}px,${e.clientY - 2}px)` }, true)
    addEventListener('mousedown', (e) => {
      c.classList.add('down')
      const r = document.createElement('div'); r.className = 'demo-ring'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'
      document.body.appendChild(r); setTimeout(() => r.remove(), 600)
    }, true)
    addEventListener('mouseup', () => c.classList.remove('down'), true)
  }
  window.__demo = {
    caption(text) {
      const el = document.getElementById('demo-caption')
      if (!text) return el.classList.remove('on')
      el.textContent = text; el.classList.add('on')
    },
    card(html) {
      const el = document.getElementById('demo-card')
      if (html) { el.innerHTML = html; el.classList.add('on') } else el.classList.remove('on')
    },
    cardNow(html) {
      const el = document.getElementById('demo-card')
      el.style.transition = 'none'; el.innerHTML = html; el.classList.add('on'); el.offsetHeight; el.style.transition = ''
    },
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init()
})

const page = await context.newPage()
const events = []
const log = (type, extra = {}) => events.push({ t: Date.now() / 1000, type, ...extra })
const wait = (ms) => page.waitForTimeout(ms)

// ── Mouse and keyboard helpers ────────────────────────────────────────────
let mx = W / 2, my = H / 2
async function moveTo(x, y, ms = 650) {
  const steps = Math.max(8, Math.round(ms / 34))
  const sx = mx, sy = my
  // A slight arc looks more like a hand than a straight line.
  const bend = (Math.random() - 0.5) * 0.12
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    const px = sx + (x - sx) * e - (y - sy) * bend * Math.sin(Math.PI * t)
    const py = sy + (y - sy) * e + (x - sx) * bend * Math.sin(Math.PI * t)
    await page.mouse.move(px, py)
    await wait(ms / steps)
  }
  mx = x; my = y
}
async function point(target, { dx = 0.5, dy = 0.5, ms } = {}) {
  const loc = typeof target === 'string' ? page.locator(target).first() : target
  await loc.waitFor({ state: 'visible' })
  const hidden = await loc.evaluate((el) => {
    const box = el.closest('.list-scroll')
    if (!box) return false
    const a = el.getBoundingClientRect(), c = box.getBoundingClientRect()
    return a.top < c.top || a.bottom > c.bottom
  })
  if (hidden) {
    const lb = await page.locator('.list-scroll').boundingBox()
    await moveTo(lb.x + lb.width * 0.5, lb.y + lb.height * 0.6, 500)
    await loc.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    await wait(900)
  }
  const b = await loc.boundingBox()
  const x = b.x + b.width * dx, y = b.y + b.height * dy
  const dist = Math.hypot(x - mx, y - my)
  await moveTo(x, y, ms ?? Math.min(750, 250 + dist * 0.5))
}
async function click(target, opts = {}) {
  await point(target, opts)
  await wait(140)
  log('click')
  await page.mouse.down()
  await wait(70)
  await page.mouse.up()
  await wait(opts.after ?? 350)
}
async function type(text, { min = 38, max = 85 } = {}) {
  for (const ch of text) {
    log(ch === ' ' ? 'space' : 'key')
    if (ch === '\n') await page.keyboard.press('Enter')
    else await page.keyboard.type(ch)
    await wait(min + Math.random() * (max - min) + (ch === ' ' ? 30 : 0) + (/[.,!?]/.test(ch) ? 120 : 0))
  }
}
async function press(key) {
  log('key')
  await page.keyboard.press(key)
  await wait(120)
}
const caption = (t) => page.evaluate((t) => window.__demo.caption(t), t)
const role = (r, name) => page.getByRole(r, { name, exact: true })
const row = (title) => page.locator('.qrow', { hasText: title })

// ── Screen capture (CDP screencast) ───────────────────────────────────────
const frames = []
const cdp = await context.newCDPSession(page)
let n = 0
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const file = `f${String(n++).padStart(6, '0')}.jpg`
  fs.writeFileSync(path.join(FRAMES, file), Buffer.from(data, 'base64'))
  frames.push({ t: metadata.timestamp, file })
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
})

// ── The demo ──────────────────────────────────────────────────────────────
await page.goto(`${APP}#/login`)
await page.evaluate(() => document.fonts.ready)
await page.locator('input[type=text]').waitFor()
await page.mouse.move(mx, my)
await page.evaluate(() => window.__demo.cardNow('<h1>Dungeon Quest Log</h1><div class="rule"></div><p>The party’s shared journal of quests</p>'))
await wait(1200)

await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 })
log('start')
await wait(4200)
await page.evaluate(() => window.__demo.card(null))
await wait(1300)

// 1. Login
await caption('Sign in with your character’s name and the party password')
await wait(1200)
await click('input[type=text]')
await type(ME)
await wait(300)
await click('input[type=password]')
await type('mellon', { min: 70, max: 140 })
await wait(400)
await click(role('button', 'Open the book'), { after: 1200 })
await row('The Missing Caravan').waitFor()

// 2. The log
await caption('Every quest the party has taken, grouped by status')
await wait(1000)
await point(row('The Missing Caravan'), { dx: 0.3 })
await wait(500)
await point(row('Find the Cartographer'), { dx: 0.4 })
await wait(700)

// 3. Read a quest
await caption('Pick a quest to read the full entry')
await click(row('The Lich’s Phylactery'), { dx: 0.3, after: 3200 })
await click(row('The Missing Caravan'), { dx: 0.3, after: 2600 })

// 4. Ribbons
await caption('The ribbons on the edge of the book filter the log')
await wait(600)
for (const tab of ['Active', 'On hold', 'Fulfilled', 'Archive']) await click(role('tab', tab), { dx: 0.7, after: 1250 })
await click(role('tab', 'All quests'), { dx: 0.7, after: 900 })

// 5. Inscribe a new quest
await caption('Inscribe a new quest as soon as the party hears of it')
await click(role('button', 'Inscribe a quest'), { after: 600 })
await click('input.editor-title', { dx: 0.15 })
await type('The Drowned Bell of Saltmere')
await wait(300)
await click('#f-date', { dx: 0.12 })
await type('17102026', { min: 60, max: 110 })
await click('#f-session', { dx: 0.3 })
await type('6')
await click('#f-giver', { dx: 0.3 })
await type('Harbourmaster Quill')
await click('#f-at', { dx: 0.3 })
await type('The Gilded Goose')
await click('#f-where', { dx: 0.2 })
await type('Saltmere Sound')
await wait(300)
await caption('Write up what you learned, with simple formatting')
await click('.editor-content .ProseMirror', { dx: 0.3, dy: 0.25 })
await type('Every night at low tide a bell tolls beneath the waves of Saltmere Sound, and the fishing boats stay in harbour. ')
await click(role('button', 'Bold'), { after: 200 })
await type('Nobody has rung it in a hundred years.')
await click(role('button', 'Bold'), { after: 200 })
await press('Enter')
await click(role('button', 'Bullet list'), { after: 200 })
await type('Find the old bell keeper')
await press('Enter')
await type('Borrow a boat that floats')
await wait(600)
await click(role('button', 'Seal the entry'), { after: 2800 })

// 6. Status and the wax seal
await caption('Change a quest’s status and the wax seal follows')
await click(row('The Missing Caravan'), { dx: 0.3, after: 1400 })
await click(role('button', 'Mark fulfilled'), { after: 2600 })

// 7. Amend
await caption('Amend an entry at any time')
await click(row('The Drowned Bell'), { dx: 0.3, after: 1200 })
await click(role('button', 'Amend'), { after: 900 })
await click('.editor-content .ProseMirror', { dx: 0.6, dy: 0.9, after: 200 })
await press('Control+End')
await press('Enter')
await press('Enter')
await type('Quill pays 200 gold for the bell.')
await wait(500)
await caption('While you write, the quest is locked so nobody overwrites you')
await wait(1500)
await click(role('button', 'Seal the entry'), { after: 2200 })

// 8. Live updates from the rest of the party
await caption('Changes by the rest of the party appear live')
await moveTo(1000, 620, 600)
await wait(900)
const lich = quests[Q.lich]
const borinLock = { quest_id: lich.id, client_id: 'borin-tab', holder_name: 'Borin', acquired_at: new Date().toISOString(), expires_at: new Date(Date.now() + 120_000).toISOString() }
locks[lich.id] = borinLock
pushChange('quest_locks', 'INSERT', borinLock)
await wait(1500)
await click(row('The Lich’s Phylactery'), { dx: 0.3, after: 600 })
await point(role('button', 'Amend'), {})
await wait(2600)
delete locks[lich.id]
Object.assign(lich, {
  description: lich.description.replace('</ul>', '<li><strong>The box is hidden under the altar of Mor.</strong></li></ul>'),
  version: lich.version + 1, updated_at: new Date().toISOString(), updated_by_name: 'Borin',
})
pushChange('quests', 'UPDATE', { ...lich }, { id: lich.id })
pushChange('quest_locks', 'DELETE', null, { quest_id: lich.id })
await wait(3200)
const giantId = crypto.randomUUID()
const t = new Date().toISOString()
quests[giantId] = { id: giantId, quest_number: nextNumber++, title: 'Wake the Sleeping Giant of Kharn', status: 'active', archived: false, version: 1,
  created_at: t, updated_at: t, created_by_name: 'Mira', updated_by_name: 'Mira', session_number: 6, date_received: '2026-10-17',
  quest_giver: 'The hermit of Kharn', location_received: 'Kharn foothills', quest_location: 'Mount Kharn',
  description: '<p>The hermit says the giant has slept for a thousand years and must be woken before the frost comes.</p>' }
pushChange('quests', 'INSERT', { ...quests[giantId] })
await wait(3600)

// 9. Archive
await caption('Done with a quest? Archive it. Nothing is ever deleted.')
await click(row('Rats in the Cellar'), { dx: 0.3, after: 1200 })
await click(role('button', 'Archive'), { after: 1500 })
await click(role('tab', 'Archive'), { dx: 0.7, after: 2000 })
await click(role('tab', 'All quests'), { dx: 0.7, after: 1200 })

// 10. Close the book
await caption('Close the book when the session is over')
await click(role('button', 'Close the book'), { after: 1800 })
await caption(null)
await moveTo(1500, 900, 500)
await page.evaluate(() => window.__demo.card('<h1>Dungeon Quest Log</h1><div class="rule"></div><p>Start Docker Desktop, double-click <b>run.bat</b>, and open the book.</p><p class="small">Ask your DM for the party password.</p>'))
await wait(5200)
log('end')
await cdp.send('Page.stopScreencast')
await wait(300)
await browser.close()

fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify(frames))
fs.writeFileSync(path.join(OUT, 'events.json'), JSON.stringify(events))
console.log(`frames: ${frames.length}, events: ${events.length}, length: ${(events.at(-1).t - events[0].t).toFixed(1)} s`)
