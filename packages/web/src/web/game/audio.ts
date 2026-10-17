// Fully procedural audio: every sound and every note is synthesised in the
// browser with WebAudio, so nothing is sampled from anyone else's work.

export type AudioSettings = {
  master: number;
  music: number;
  sfx: number;
};

type Track = "day" | "night" | "boss" | null;

const SCALE_DAY = [0, 2, 4, 7, 9, 12, 14, 16];
const SCALE_NIGHT = [0, 2, 3, 7, 8, 12, 14, 15];
const SCALE_BOSS = [0, 1, 3, 6, 7, 10, 12, 13];

export class AudioEngine {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  musicGain: GainNode | null = null;
  sfxGain: GainNode | null = null;
  settings: AudioSettings = { master: 0.7, music: 0.5, sfx: 0.8 };
  private track: Track = null;
  private musicTimer: number | null = null;
  private step = 0;
  private noiseBuf: AudioBuffer | null = null;

  init() {
    if (this.ctx) return;
    type WindowWithAudio = Window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as WindowWithAudio).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.masterGain = ctx.createGain();
    this.musicGain = ctx.createGain();
    this.sfxGain = ctx.createGain();
    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(ctx.destination);
    this.applySettings();

    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  setSettings(s: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...s };
    this.applySettings();
  }

  private applySettings() {
    if (this.masterGain) this.masterGain.gain.value = this.settings.master;
    if (this.musicGain) this.musicGain.gain.value = this.settings.music * 0.35;
    if (this.sfxGain) this.sfxGain.gain.value = this.settings.sfx * 0.6;
  }

  private tone(opts: {
    freq: number;
    dur: number;
    type?: OscillatorType;
    gain?: number;
    slideTo?: number;
    delay?: number;
    dest?: GainNode | null;
    attack?: number;
  }) {
    const ctx = this.ctx;
    const dest = opts.dest ?? this.sfxGain;
    if (!ctx || !dest) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? "square";
    osc.frequency.setValueAtTime(Math.max(20, opts.freq), t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), t0 + opts.dur);
    const peak = opts.gain ?? 0.3;
    const atk = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.02);
  }

  private noise(opts: { dur: number; gain?: number; filter?: number; type?: BiquadFilterType; delay?: number }) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain || !this.noiseBuf) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = opts.type ?? "lowpass";
    filt.frequency.value = opts.filter ?? 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain ?? 0.25, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + opts.dur + 0.02);
  }

  /* --------------------------- sfx library -------------------------- */

  sfx(name: string) {
    if (!this.ctx) return;
    switch (name) {
      case "mine_tick":
        this.noise({ dur: 0.07, gain: 0.18, filter: 900 });
        this.tone({ freq: 180 + Math.random() * 60, dur: 0.05, type: "triangle", gain: 0.12 });
        break;
      case "mine_break":
        this.noise({ dur: 0.18, gain: 0.3, filter: 1600 });
        this.tone({ freq: 240, slideTo: 90, dur: 0.16, type: "square", gain: 0.16 });
        break;
      case "place":
        this.tone({ freq: 320, slideTo: 460, dur: 0.08, type: "square", gain: 0.16 });
        this.noise({ dur: 0.06, gain: 0.12, filter: 700 });
        break;
      case "swing":
        this.noise({ dur: 0.1, gain: 0.16, filter: 2600, type: "highpass" });
        break;
      case "hit":
        this.tone({ freq: 420, slideTo: 140, dur: 0.12, type: "square", gain: 0.22 });
        this.noise({ dur: 0.08, gain: 0.16, filter: 1800 });
        break;
      case "shoot":
        this.tone({ freq: 880, slideTo: 300, dur: 0.12, type: "sawtooth", gain: 0.16 });
        break;
      case "magic":
        this.tone({ freq: 620, slideTo: 1400, dur: 0.18, type: "sine", gain: 0.18 });
        this.tone({ freq: 930, slideTo: 1800, dur: 0.14, type: "triangle", gain: 0.1, delay: 0.03 });
        break;
      case "hurt":
        this.tone({ freq: 300, slideTo: 110, dur: 0.22, type: "sawtooth", gain: 0.25 });
        break;
      case "enemy_die":
        this.tone({ freq: 220, slideTo: 60, dur: 0.3, type: "square", gain: 0.2 });
        this.noise({ dur: 0.2, gain: 0.18, filter: 900 });
        break;
      case "pickup":
        this.tone({ freq: 720, dur: 0.06, type: "square", gain: 0.12 });
        this.tone({ freq: 1080, dur: 0.07, type: "square", gain: 0.1, delay: 0.05 });
        break;
      case "coin":
        this.tone({ freq: 1200, dur: 0.05, type: "square", gain: 0.1 });
        this.tone({ freq: 1600, dur: 0.08, type: "square", gain: 0.09, delay: 0.04 });
        break;
      case "craft":
        this.tone({ freq: 400, dur: 0.08, type: "triangle", gain: 0.16 });
        this.tone({ freq: 600, dur: 0.1, type: "triangle", gain: 0.14, delay: 0.07 });
        this.tone({ freq: 900, dur: 0.12, type: "triangle", gain: 0.12, delay: 0.15 });
        break;
      case "ui":
        this.tone({ freq: 540, dur: 0.05, type: "square", gain: 0.1 });
        break;
      case "open":
        this.tone({ freq: 300, slideTo: 520, dur: 0.14, type: "triangle", gain: 0.15 });
        break;
      case "potion":
        this.tone({ freq: 500, slideTo: 900, dur: 0.22, type: "sine", gain: 0.18 });
        break;
      case "level":
        [0, 4, 7, 12].forEach((n, i) =>
          this.tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.2, type: "triangle", gain: 0.16, delay: i * 0.09 }),
        );
        break;
      case "boss_spawn":
        this.tone({ freq: 180, slideTo: 60, dur: 1.1, type: "sawtooth", gain: 0.3 });
        this.noise({ dur: 0.9, gain: 0.22, filter: 400 });
        break;
      case "boss_die":
        [0, -3, -7, -12].forEach((n, i) =>
          this.tone({ freq: 330 * Math.pow(2, n / 12), dur: 0.5, type: "sawtooth", gain: 0.22, delay: i * 0.16 }),
        );
        this.noise({ dur: 1.2, gain: 0.25, filter: 700 });
        break;
      case "death":
        [0, -2, -5, -9, -14].forEach((n, i) =>
          this.tone({ freq: 400 * Math.pow(2, n / 12), dur: 0.4, type: "triangle", gain: 0.2, delay: i * 0.18 }),
        );
        break;
      case "event":
        [0, 7, 12].forEach((n, i) =>
          this.tone({ freq: 520 * Math.pow(2, n / 12), dur: 0.3, type: "sine", gain: 0.18, delay: i * 0.12 }),
        );
        break;
      case "ambient_drip":
        this.tone({ freq: 900 + Math.random() * 500, slideTo: 300, dur: 0.18, type: "sine", gain: 0.08 });
        break;
      case "ambient_wind":
        this.noise({ dur: 1.4, gain: 0.05, filter: 500 });
        break;
      default:
        break;
    }
  }

  /* ----------------------------- music ------------------------------ */

  setTrack(t: Track) {
    if (this.track === t) return;
    this.track = t;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (!t || !this.ctx) return;
    this.step = 0;
    const bpm = t === "boss" ? 148 : t === "night" ? 78 : 96;
    const interval = (60 / bpm / 2) * 1000;
    this.musicTimer = window.setInterval(() => this.musicStep(), interval);
  }

  private musicStep() {
    const t = this.track;
    if (!t || !this.ctx || !this.musicGain) return;
    const s = this.step++;
    const scale = t === "boss" ? SCALE_BOSS : t === "night" ? SCALE_NIGHT : SCALE_DAY;
    const root = t === "boss" ? 110 : t === "night" ? 131 : 174;
    const bar = Math.floor(s / 8) % 4;

    // bass
    if (s % 4 === 0) {
      const deg = [0, 3, 5, 4][bar] ?? 0;
      const f = root * Math.pow(2, ((scale[deg] ?? 0) - 12) / 12);
      this.tone({ freq: f, dur: t === "boss" ? 0.34 : 0.5, type: "triangle", gain: 0.3, dest: this.musicGain });
    }
    // arpeggio melody
    if (t === "boss" ? true : s % 2 === 0) {
      const seedLike = Math.sin(s * 12.9898) * 43758.5453;
      const r = seedLike - Math.floor(seedLike);
      const deg = scale[Math.floor(r * scale.length)] ?? 0;
      const oct = r > 0.8 ? 12 : 0;
      const f = root * 2 * Math.pow(2, (deg + oct) / 12);
      this.tone({
        freq: f,
        dur: t === "boss" ? 0.14 : 0.24,
        type: t === "night" ? "sine" : "square",
        gain: t === "boss" ? 0.16 : 0.12,
        dest: this.musicGain,
      });
    }
    // percussion
    if (t === "boss" && s % 2 === 0) {
      this.noise({ dur: 0.08, gain: 0.1, filter: 3000, type: "highpass" });
    }
    if (t !== "night" && s % 8 === 4) {
      this.noise({ dur: 0.12, gain: 0.06, filter: 2200, type: "highpass" });
    }
  }

  stopMusic() {
    this.setTrack(null);
  }
}

export const audio = new AudioEngine();
