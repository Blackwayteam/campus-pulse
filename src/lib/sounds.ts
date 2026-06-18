let audioCtx: AudioContext | null = null

export const VOLUME_FULL = 1.0
export const VOLUME_AMBIENT = 0.22

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext
      if (!AC) return null
      audioCtx = new AC()
    }
    if (audioCtx.state === 'suspended') audioCtx.resume()
    return audioCtx
  } catch (e) { return null }
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
    }
  } catch (e) { console.warn('Reaction sound error:', e) }
}

// 🔥 BUSUUSH BUUSH — Big explosion for cancelled announcements
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

// 🔥 FIRE REACTION — sharp crack + sub thump + metallic tail
// Punchy single-shot character, built to retrigger cleanly on rapid clicks
function fireBlast(ctx: AudioContext, dest: AudioNode) {
  const now = ctx.currentTime

  const crackSize = Math.floor(ctx.sampleRate * 0.05)
  const crackBuf = ctx.createBuffer(1, crackSize, ctx.sampleRate)
  const crackData = crackBuf.getChannelData(0)
  for (let i = 0; i < crackSize; i++) {
    const decay = 1 - i / crackSize
    crackData[i] = (Math.random() * 2 - 1) * decay
  }
  const crack = ctx.createBufferSource()
  crack.buffer = crackBuf
  const crackFilter = ctx.createBiquadFilter()
  crackFilter.type = 'highpass'
  crackFilter.frequency.value = 900
  const crackGain = ctx.createGain()
  crack.connect(crackFilter); crackFilter.connect(crackGain); crackGain.connect(dest)
  crackGain.gain.setValueAtTime(3.2, now)
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045)
  crack.start(now); crack.stop(now + 0.05)

  const thump = ctx.createOscillator()
  const thumpGain = ctx.createGain()
  thump.connect(thumpGain); thumpGain.connect(dest)
  thump.type = 'sine'
  thump.frequency.setValueAtTime(150, now)
  thump.frequency.exponentialRampToValueAtTime(38, now + 0.09)
  thumpGain.gain.setValueAtTime(2.2, now)
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
  thump.start(now); thump.stop(now + 0.1)

  const ring = ctx.createOscillator()
  const ringGain = ctx.createGain()
  ring.connect(ringGain); ringGain.connect(dest)
  ring.type = 'triangle'
  ring.frequency.value = 1800
  ringGain.gain.setValueAtTime(0.001, now + 0.02)
  ringGain.gain.linearRampToValueAtTime(0.5, now + 0.03)
  ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
  ring.start(now + 0.02); ring.stop(now + 0.18)
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