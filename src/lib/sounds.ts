let audioCtx: AudioContext | null = null

export const VOLUME_FULL = 1.0
export const VOLUME_AMBIENT = 0.40

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return null
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AC()
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    return audioCtx
  } catch (e) {
    console.warn('AudioContext failed:', e)
    return null
  }
}

export function resumeAudio() {
  const ctx = getCtx()
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
}

function makeMaster(ctx: AudioContext, volume: number): GainNode {
  const master = ctx.createGain()
  master.gain.value = volume
  master.connect(ctx.destination)
  return master
}

export function playSound(status: string, volume: number = VOLUME_FULL) {
  const ctx = getCtx()
  if (!ctx) return
  try {
    const dest = makeMaster(ctx, volume)
    switch (status) {
      case 'cancelled': bigExplosion(ctx, dest); break
      case 'confirmed': rainChime(ctx, dest); break
      case 'delayed':   warningBeep(ctx, dest); break
      case 'pending':   tensionDrone(ctx, dest); break
      case 'broadcast': broadcastFanfare(ctx, dest); break
      case 'warning':   bigExplosion(ctx, dest); break
    }
  } catch (e) { console.warn('Sound error:', e) }
}

export function playReactionSound(emoji: string, volume: number = VOLUME_FULL) {
  const ctx = getCtx()
  if (!ctx) return
  try {
    const dest = makeMaster(ctx, volume)
    switch (emoji) {
      case '🔥': fireBlast(ctx, dest); break
      case '😂': laughSound(ctx, dest); break
      case '😭': crySound(ctx, dest); break
      case '⚡': zapSound(ctx, dest); break
      case '☕': warmTone(ctx, dest); break
      case '🎉': popSound(ctx, dest); break
      case '🔫': gunBurst(ctx, dest); break
    }
  } catch (e) { console.warn('Reaction sound error:', e) }
}

// 🔥 BIG EXPLOSION — for cancelled announcements (the whole-campus blast)
function bigExplosion(ctx: AudioContext, dest: AudioNode) {
  const now = ctx.currentTime
  const bufferSize = Math.floor(ctx.sampleRate * 1.5)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

  const noise1 = ctx.createBufferSource()
  noise1.buffer = buffer
  const filter1 = ctx.createBiquadFilter()
  filter1.type = 'lowpass'
  filter1.frequency.value = 600
  const gain1 = ctx.createGain()
  noise1.connect(filter1); filter1.connect(gain1); gain1.connect(dest)
  gain1.gain.setValueAtTime(0.001, now)
  gain1.gain.exponentialRampToValueAtTime(4.0, now + 0.02)
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
  noise1.start(now); noise1.stop(now + 0.55)

  const bass1 = ctx.createOscillator()
  const bGain1 = ctx.createGain()
  bass1.connect(bGain1); bGain1.connect(dest)
  bass1.type = 'sine'
  bass1.frequency.setValueAtTime(120, now)
  bass1.frequency.exponentialRampToValueAtTime(25, now + 0.45)
  bGain1.gain.setValueAtTime(4.0, now)
  bGain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
  bass1.start(now); bass1.stop(now + 0.45)

  const noise2 = ctx.createBufferSource()
  noise2.buffer = buffer
  const filter2 = ctx.createBiquadFilter()
  filter2.type = 'lowpass'
  filter2.frequency.value = 400
  const gain2 = ctx.createGain()
  noise2.connect(filter2); filter2.connect(gain2); gain2.connect(dest)
  gain2.gain.setValueAtTime(0.001, now + 0.6)
  gain2.gain.exponentialRampToValueAtTime(2.5, now + 0.63)
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.0)
  noise2.start(now + 0.6); noise2.stop(now + 1.05)

  const bass2 = ctx.createOscillator()
  const bGain2 = ctx.createGain()
  bass2.connect(bGain2); bGain2.connect(dest)
  bass2.type = 'sine'
  bass2.frequency.setValueAtTime(90, now + 0.6)
  bass2.frequency.exponentialRampToValueAtTime(20, now + 0.95)
  bGain2.gain.setValueAtTime(3.0, now + 0.6)
  bGain2.gain.exponentialRampToValueAtTime(0.001, now + 0.95)
  bass2.start(now + 0.6); bass2.stop(now + 1.0)

  for (let i = 0; i < 10; i++) {
    const crackle = ctx.createBufferSource()
    crackle.buffer = buffer
    const cGain = ctx.createGain()
    const cFilter = ctx.createBiquadFilter()
    cFilter.type = 'bandpass'
    cFilter.frequency.value = 600 + Math.random() * 2000
    crackle.connect(cFilter); cFilter.connect(cGain); cGain.connect(dest)
    const t = now + 0.05 + Math.random() * 0.9
    cGain.gain.setValueAtTime(0.4 + Math.random() * 0.4, t)
    cGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    crackle.start(t); crackle.stop(t + 0.07)
  }
}

// 🔥 FIRE REACTION — roaring whoosh + crackle. Sounds like an actual flame, not a gunshot.
function fireBlast(ctx: AudioContext, dest: AudioNode) {
  const now = ctx.currentTime

  const whooshSize = Math.floor(ctx.sampleRate * 0.45)
  const whooshBuf = ctx.createBuffer(1, whooshSize, ctx.sampleRate)
  const whooshData = whooshBuf.getChannelData(0)
  for (let i = 0; i < whooshSize; i++) whooshData[i] = Math.random() * 2 - 1
  const whoosh = ctx.createBufferSource()
  whoosh.buffer = whooshBuf
  const whooshFilter = ctx.createBiquadFilter()
  whooshFilter.type = 'bandpass'
  whooshFilter.Q.value = 0.9
  whooshFilter.frequency.setValueAtTime(300, now)
  whooshFilter.frequency.exponentialRampToValueAtTime(2200, now + 0.18)
  whooshFilter.frequency.exponentialRampToValueAtTime(600, now + 0.4)
  const whooshGain = ctx.createGain()
  whoosh.connect(whooshFilter); whooshFilter.connect(whooshGain); whooshGain.connect(dest)
  whooshGain.gain.setValueAtTime(0.001, now)
  whooshGain.gain.linearRampToValueAtTime(2.6, now + 0.05)
  whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
  whoosh.start(now); whoosh.stop(now + 0.45)

  const rumble = ctx.createOscillator()
  const rumbleGain = ctx.createGain()
  rumble.connect(rumbleGain); rumbleGain.connect(dest)
  rumble.type = 'sine'
  rumble.frequency.setValueAtTime(85, now)
  rumble.frequency.exponentialRampToValueAtTime(40, now + 0.4)
  rumbleGain.gain.setValueAtTime(1.8, now)
  rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
  rumble.start(now); rumble.stop(now + 0.4)

  for (let i = 0; i < 6; i++) {
    const size = Math.floor(ctx.sampleRate * 0.03)
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let j = 0; j < size; j++) data[j] = Math.random() * 2 - 1
    const crackle = ctx.createBufferSource()
    crackle.buffer = buffer
    const cFilter = ctx.createBiquadFilter()
    cFilter.type = 'bandpass'
    cFilter.frequency.value = 1000 + Math.random() * 2500
    const cGain = ctx.createGain()
    crackle.connect(cFilter); cFilter.connect(cGain); cGain.connect(dest)
    const t = now + 0.04 + Math.random() * 0.38
    cGain.gain.setValueAtTime(0.8 + Math.random() * 0.6, t)
    cGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
    crackle.start(t); crackle.stop(t + 0.05)
  }
}

// 🔫 GUN BURST — Terminator-style three-round burst, sharp and mechanical
function gunBurst(ctx: AudioContext, dest: AudioNode) {
  const now = ctx.currentTime
  const shots = 3
  for (let i = 0; i < shots; i++) {
    const t = now + i * 0.07
    const size = Math.floor(ctx.sampleRate * 0.04)
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let j = 0; j < size; j++) {
      const decay = 1 - j / size
      data[j] = (Math.random() * 2 - 1) * decay
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1400 + Math.random() * 400
    filter.Q.value = 0.7
    const gain = ctx.createGain()
    noise.connect(filter); filter.connect(gain); gain.connect(dest)
    gain.gain.setValueAtTime(3.0 - i * 0.4, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035)
    noise.start(t); noise.stop(t + 0.04)

    const click = ctx.createOscillator()
    const clickGain = ctx.createGain()
    click.connect(clickGain); clickGain.connect(dest)
    click.type = 'square'
    click.frequency.value = 2200
    clickGain.gain.setValueAtTime(0.5, t)
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02)
    click.start(t); click.stop(t + 0.02)

    const thump = ctx.createOscillator()
    const thumpGain = ctx.createGain()
    thump.connect(thumpGain); thumpGain.connect(dest)
    thump.type = 'sine'
    thump.frequency.setValueAtTime(110, t)
    thump.frequency.exponentialRampToValueAtTime(45, t + 0.05)
    thumpGain.gain.setValueAtTime(1.4, t)
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
    thump.start(t); thump.stop(t + 0.05)
  }
}

function laughSound(ctx: AudioContext, dest: AudioNode) {
  const freqs = [380, 480, 430, 530, 480, 580]
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(dest)
    const t = ctx.currentTime + i * 0.055
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.3, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
    osc.start(t); osc.stop(t + 0.06)
  })
}

function crySound(ctx: AudioContext, dest: AudioNode) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()
  lfo.connect(lfoGain); lfoGain.connect(osc.frequency)
  osc.connect(gain); gain.connect(dest)
  lfo.frequency.value = 7
  lfoGain.gain.value = 25
  osc.type = 'sine'
  osc.frequency.setValueAtTime(520, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.5)
  gain.gain.setValueAtTime(0.35, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55)
  lfo.start(ctx.currentTime); osc.start(ctx.currentTime)
  lfo.stop(ctx.currentTime + 0.55); osc.stop(ctx.currentTime + 0.55)
}

function zapSound(ctx: AudioContext, dest: AudioNode) {
  const now = ctx.currentTime
  const bufferSize = Math.floor(ctx.sampleRate * 0.12)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 3500
  const gain = ctx.createGain()
  noise.connect(filter); filter.connect(gain); gain.connect(dest)
  gain.gain.setValueAtTime(2.0, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
  noise.start(now); noise.stop(now + 0.12)
  const osc = ctx.createOscillator()
  const oscGain = ctx.createGain()
  osc.connect(oscGain); oscGain.connect(dest)
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(2200, now)
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.1)
  oscGain.gain.setValueAtTime(0.4, now)
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
  osc.start(now); osc.stop(now + 0.1)
}

function warmTone(ctx: AudioContext, dest: AudioNode) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain); gain.connect(dest)
  osc.type = 'sine'
  osc.frequency.value = 220
  gain.gain.setValueAtTime(0.001, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.08)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5)
}

function popSound(ctx: AudioContext, dest: AudioNode) {
  const now = ctx.currentTime
  const bufferSize = Math.floor(ctx.sampleRate * 0.04)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  const gain = ctx.createGain()
  noise.connect(gain); gain.connect(dest)
  gain.gain.setValueAtTime(2.0, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03)
  noise.start(now); noise.stop(now + 0.04)
  const sparkle = [1047, 1319, 1568, 2093]
  sparkle.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(dest)
    osc.type = 'sine'
    osc.frequency.value = freq
    const t = now + 0.04 + i * 0.07
    g.gain.setValueAtTime(0.25, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    osc.start(t); osc.stop(t + 0.2)
  })
}

function rainChime(ctx: AudioContext, dest: AudioNode) {
  const freqs = [523, 659, 784, 1047, 1319]
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(dest)
    const t = ctx.currentTime + i * 0.14
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.35, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2)
    osc.start(t); osc.stop(t + 1.2)
  })
}

function warningBeep(ctx: AudioContext, dest: AudioNode) {
  for (let i = 0; i < 2; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(dest)
    const t = ctx.currentTime + i * 0.35
    osc.type = 'square'
    osc.frequency.value = 700
    gain.gain.setValueAtTime(0.3, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
    osc.start(t); osc.stop(t + 0.25)
  }
}

function tensionDrone(ctx: AudioContext, dest: AudioNode) {
  for (let i = 0; i < 4; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(dest)
    const t = ctx.currentTime + i * 0.3
    osc.type = 'sine'
    osc.frequency.value = 120 + i * 20
    gain.gain.setValueAtTime(0.001, t)
    gain.gain.linearRampToValueAtTime(0.25, t + 0.15)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
    osc.start(t); osc.stop(t + 0.3)
  }
}

function broadcastFanfare(ctx: AudioContext, dest: AudioNode) {
  const notes = [440, 554, 659, 880]
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(dest)
    const t = ctx.currentTime + i * 0.18
    osc.type = 'triangle'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.4, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    osc.start(t); osc.stop(t + 0.35)
  })
}


// ── AMBIENT LOOPS — tied to live building status on the map ──

let activeLoops: Record<string, { source: { stop: () => void }; gain: GainNode; extra?: any[] }> = {}
let ambientBus: DynamicsCompressorNode | null = null

function getAmbientBus(ctx: AudioContext): DynamicsCompressorNode {
  if (!ambientBus) {
    ambientBus = ctx.createDynamicsCompressor()
    ambientBus.threshold.value = -28
    ambientBus.knee.value = 18
    ambientBus.ratio.value = 5
    ambientBus.attack.value = 0.01
    ambientBus.release.value = 0.3
    ambientBus.connect(ctx.destination)
  }
  return ambientBus
}

function stopLoop(key: string, fadeMs: number = 400) {
  const loop = activeLoops[key]
  if (!loop) return
  const ctx = audioCtx
  if (ctx) {
    loop.gain.gain.cancelScheduledValues(ctx.currentTime)
    loop.gain.gain.setValueAtTime(loop.gain.gain.value, ctx.currentTime)
    loop.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeMs / 1000)
  }
  setTimeout(() => {
    try { loop.source.stop() } catch (e) {}
    loop.extra?.forEach(node => { try { node.stop() } catch (e) {} })
  }, fadeMs + 50)
  delete activeLoops[key]
}

function stopAllLoops() {
  Object.keys(activeLoops).forEach(key => stopLoop(key, 300))
}

// 🔥 FIRE — breathing low rumble + flutter shimmer + warm pops + occasional flare
function startFireAmbient(volume: number = 0.42) {
  const ctx = getCtx()
  if (!ctx || activeLoops['cancelled']) return
  const bus = getAmbientBus(ctx)

  // Rumble bed — slow filter "breathing" simulates flame movement
  const bufSize = ctx.sampleRate * 2
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
  const data = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < bufSize; i++) {
    const white = Math.random() * 2 - 1
    last = last * 0.98 + white * 0.02
    data[i] = last * 3.5
  }
  const rumbleSource = ctx.createBufferSource()
  rumbleSource.buffer = buf
  rumbleSource.loop = true

  const rumbleFilter = ctx.createBiquadFilter()
  rumbleFilter.type = 'lowpass'
  rumbleFilter.frequency.value = 220
  rumbleFilter.Q.value = 0.7

  const filterLFO = ctx.createOscillator()
  filterLFO.frequency.value = 0.35
  const filterLFOGain = ctx.createGain()
  filterLFOGain.gain.value = 90
  filterLFO.connect(filterLFOGain)
  filterLFOGain.connect(rumbleFilter.frequency)
  filterLFO.start()

  const rumbleGain = ctx.createGain()
  rumbleGain.gain.value = 0
  rumbleSource.connect(rumbleFilter)
  rumbleFilter.connect(rumbleGain)
  rumbleGain.connect(bus)
  rumbleGain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.8)
  rumbleSource.start()

  // Flutter layer — flame flicker shimmer
  const flutterBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
  const flutterData = flutterBuf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) flutterData[i] = Math.random() * 2 - 1
  const flutterSource = ctx.createBufferSource()
  flutterSource.buffer = flutterBuf
  flutterSource.loop = true
  const flutterFilter = ctx.createBiquadFilter()
  flutterFilter.type = 'bandpass'
  flutterFilter.frequency.value = 1200
  flutterFilter.Q.value = 0.8
  const flutterGain = ctx.createGain()
  flutterGain.gain.value = 0
  flutterSource.connect(flutterFilter); flutterFilter.connect(flutterGain); flutterGain.connect(bus)
  flutterGain.gain.linearRampToValueAtTime(volume * 0.18, ctx.currentTime + 0.8)
  flutterSource.start()

  // Sparse warm pops — embers
  const popInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return
    const size = Math.floor(ctx.sampleRate * 0.05)
    const b = ctx.createBuffer(1, size, ctx.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < size; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / size)
    const src = ctx.createBufferSource()
    src.buffer = b
    const filt = ctx.createBiquadFilter()
    filt.type = 'bandpass'
    filt.frequency.value = 350 + Math.random() * 500
    filt.Q.value = 1.4
    const g = ctx.createGain()
    g.gain.value = volume * (0.5 + Math.random() * 0.5)
    src.connect(filt); filt.connect(g); g.connect(bus)
    src.start(); src.stop(ctx.currentTime + 0.06)
  }, 280 + Math.random() * 400)

  // Occasional flare whoosh — flame flaring up
  const flareInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(150, t)
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.6)
    g.gain.setValueAtTime(0.001, t)
    g.gain.linearRampToValueAtTime(volume * 0.35, t + 0.15)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
    osc.connect(g); g.connect(bus)
    osc.start(t); osc.stop(t + 0.6)
  }, 4000 + Math.random() * 3000)

  activeLoops['cancelled'] = {
    source: rumbleSource,
    gain: rumbleGain,
    extra: [
      flutterSource,
      filterLFO,
      { stop: () => { clearInterval(popInterval); clearInterval(flareInterval) } },
    ],
  }
}

// 🌧️ RAIN — textured patter bed + individual droplet hits (some bigger)
function startRainAmbient(volume: number = 0.34) {
  const ctx = getCtx()
  if (!ctx || activeLoops['confirmed']) return
  const bus = getAmbientBus(ctx)

  // Bed — noise with a baked-in organic amplitude wobble, gives "rain on surface" texture
  const bedSize = ctx.sampleRate * 2
  const bedBuf = ctx.createBuffer(1, bedSize, ctx.sampleRate)
  const bedData = bedBuf.getChannelData(0)
  let env = 0.5
  for (let i = 0; i < bedSize; i++) {
    const white = Math.random() * 2 - 1
    env += (Math.random() - 0.5) * 0.02
    env = Math.max(0.2, Math.min(1, env))
    bedData[i] = white * env
  }
  const bedSource = ctx.createBufferSource()
  bedSource.buffer = bedBuf
  bedSource.loop = true
  const bedFilter = ctx.createBiquadFilter()
  bedFilter.type = 'bandpass'
  bedFilter.frequency.value = 4500
  bedFilter.Q.value = 0.5
  const bedGain = ctx.createGain()
  bedGain.gain.value = 0
  bedSource.connect(bedFilter); bedFilter.connect(bedGain); bedGain.connect(bus)
  bedGain.gain.linearRampToValueAtTime(volume * 0.5, ctx.currentTime + 0.8)
  bedSource.start()

  // Individual droplets, occasional bigger one
  const dropInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return
    const big = Math.random() < 0.12
    const size = Math.floor(ctx.sampleRate * (big ? 0.025 : 0.012))
    const buf = ctx.createBuffer(1, size, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < size; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / size)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const filt = ctx.createBiquadFilter()
    filt.type = 'bandpass'
    filt.frequency.value = big ? (1800 + Math.random() * 1200) : (3500 + Math.random() * 3000)
    filt.Q.value = 3
    const g = ctx.createGain()
    g.gain.value = volume * (big ? 0.9 : 0.3) * (0.6 + Math.random() * 0.5)
    src.connect(filt); filt.connect(g); g.connect(bus)
    src.start(); src.stop(ctx.currentTime + 0.03)
  }, 22 + Math.random() * 40)

  activeLoops['confirmed'] = {
    source: bedSource,
    gain: bedGain,
    extra: [{ stop: () => clearInterval(dropInterval) }],
  }
}

// ⏱️ DELAYED — slow rhythmic tick, like a clock counting down
function startDelayedAmbient(volume: number = 0.25) {
  const ctx = getCtx()
  if (!ctx || activeLoops['delayed']) return
  const bus = getAmbientBus(ctx)

  const carrier = ctx.createOscillator()
  carrier.frequency.value = 0
  const masterGain = ctx.createGain()
  masterGain.gain.value = 1
  carrier.connect(masterGain); masterGain.connect(bus)
  carrier.start()

  const tickInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return
    const t = ctx.createOscillator()
    const g = ctx.createGain()
    t.connect(g); g.connect(bus)
    t.type = 'square'
    t.frequency.value = 880
    g.gain.setValueAtTime(volume, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
    t.start(); t.stop(ctx.currentTime + 0.08)
  }, 900)

  activeLoops['delayed'] = {
    source: { stop: () => { try { carrier.stop() } catch (e) {} } },
    gain: masterGain,
    extra: [{ stop: () => clearInterval(tickInterval) }],
  }
}

// ⚠️ PENDING — clear repeating anticipation ping. Impossible to miss now.
function startPendingAmbient(volume: number = 0.3) {
  const ctx = getCtx()
  if (!ctx || activeLoops['pending']) return
  const bus = getAmbientBus(ctx)

  const carrier = ctx.createOscillator()
  carrier.frequency.value = 0
  const masterGain = ctx.createGain()
  masterGain.gain.value = 1
  carrier.connect(masterGain); masterGain.connect(bus)
  carrier.start()

  // Soft pad underneath, just for body
  const pad = ctx.createOscillator()
  const padGain = ctx.createGain()
  pad.type = 'sine'
  pad.frequency.value = 130
  pad.connect(padGain); padGain.connect(bus)
  padGain.gain.value = volume * 0.25
  pad.start()

  // The actual "ping" — rises in pitch, clearly audible, repeats every 1.1s
  const pingInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(520, t)
    osc.frequency.exponentialRampToValueAtTime(780, t + 0.18)
    g.gain.setValueAtTime(0.001, t)
    g.gain.linearRampToValueAtTime(volume, t + 0.04)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    osc.connect(g); g.connect(bus)
    osc.start(t); osc.stop(t + 0.3)
  }, 1100)

  activeLoops['pending'] = {
    source: { stop: () => { try { carrier.stop() } catch (e) {} } },
    gain: masterGain,
    extra: [pad, { stop: () => clearInterval(pingInterval) }],
  }
}

// 🚨 WARNING — fast urgent pulse
function startWarningAmbient(volume: number = 0.28) {
  const ctx = getCtx()
  if (!ctx || activeLoops['warning']) return
  const bus = getAmbientBus(ctx)

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = 520
  osc.connect(gain); gain.connect(bus)
  gain.gain.value = 0
  osc.start()

  const pulseInterval = setInterval(() => {
    if (!ctx) return
    gain.gain.cancelScheduledValues(ctx.currentTime)
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
  }, 350)

  activeLoops['warning'] = {
    source: { stop: () => { try { osc.stop() } catch (e) {} } },
    gain,
    extra: [{ stop: () => clearInterval(pulseInterval) }],
  }
}

// 📣 BROADCAST — gentle shimmering hold
function startBroadcastAmbient(volume: number = 0.2) {
  const ctx = getCtx()
  if (!ctx || activeLoops['broadcast']) return
  const bus = getAmbientBus(ctx)

  const osc1 = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  const gain = ctx.createGain()
  osc1.type = 'sine'; osc1.frequency.value = 440
  osc2.type = 'sine'; osc2.frequency.value = 444
  osc1.connect(gain); osc2.connect(gain); gain.connect(bus)
  gain.gain.value = 0
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.6)
  osc1.start(); osc2.start()

  activeLoops['broadcast'] = {
    source: { stop: () => { try { osc1.stop() } catch (e) {} } },
    gain,
    extra: [osc2],
  }
}

const AMBIENT_STARTERS: Record<string, () => void> = {
  cancelled: startFireAmbient,
  warning:   startWarningAmbient,
  confirmed: startRainAmbient,
  delayed:   startDelayedAmbient,
  pending:   startPendingAmbient,
  broadcast: startBroadcastAmbient,
}

export function syncAmbientLoops(activeStatuses: Set<string>) {
  Object.keys(AMBIENT_STARTERS).forEach((status) => {
    const shouldPlay = activeStatuses.has(status)
    const isPlaying = !!activeLoops[status]
    if (shouldPlay && !isPlaying) {
      AMBIENT_STARTERS[status]()
    } else if (!shouldPlay && isPlaying) {
      stopLoop(status)
    }
  })
}

export function stopAllAmbient() {
  stopAllLoops()
}