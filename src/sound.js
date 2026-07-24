import * as Tone from "tone";

// ── Sound Engine ───────────────────────────────────────────────
// Warm, acoustic-leaning palette: filtered noise clicks, struck bells,
// felt-damped low pulses. No square waves, no chiptune.
//
// Balanced as a whole rather than cue by cue: nothing here reaches below
// D2, because on a phone speaker low content is either inaudible or, at
// volume, the only thing you hear.
export const Sound = (() => {
  let ready = false;
  let muted = false;
  let reverb, room, bus;
  let tock, tockFilter, bell, sub, pad, low, air, airFilter;
  let tile, tileFilter;

  async function init() {
    if (ready) return;
    await Tone.start();

    reverb = new Tone.Reverb({ decay: 3.2, preDelay: 0.02, wet: 0.3 }).toDestination();
    room   = new Tone.Reverb({ decay: 0.9, preDelay: 0.005, wet: 0.16 }).toDestination();
    bus    = new Tone.Volume(-2).connect(reverb);

    // Soft wooden tock — brown noise through a narrow band
    tockFilter = new Tone.Filter({ type: "bandpass", frequency: 1100, Q: 6 }).connect(room);
    tock = new Tone.NoiseSynth({
      noise: { type: "brown" },
      envelope: { attack: 0.0008, decay: 0.028, sustain: 0 },
    }).connect(tockFilter);
    tock.volume.value = -15;

    // Every tap, tile drop and reel stop is this: white noise through a
    // highpass, so it reads as a mechanical click rather than a note. It
    // replaced a plucked string, which sat too low and rang too long.
    tileFilter = new Tone.Filter({ type: "highpass", frequency: 1650, Q: 0.7 }).connect(room);
    tile = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.0005, decay: 0.045, sustain: 0 },
    }).connect(tileFilter);
    tile.volume.value = -12;

    // Struck bell — FM with inharmonic ratio, long soft tail
    bell = new Tone.FMSynth({
      harmonicity: 2.6,
      modulationIndex: 5.5,
      oscillator: { type: "sine" },
      modulation: { type: "sine" },
      envelope: { attack: 0.004, decay: 1.1, sustain: 0, release: 0.9 },
      modulationEnvelope: { attack: 0.002, decay: 0.22, sustain: 0, release: 0.2 },
    }).connect(bus);
    bell.volume.value = -12;

    // Felt-damped sub pulse — the "heartbeat"
    sub = new Tone.MembraneSynth({
      pitchDecay: 0.07,
      octaves: 1.25,
      oscillator: { type: "sine" },
      envelope: { attack: 0.002, decay: 0.28, sustain: 0, release: 0.16 },
    }).connect(room);
    sub.volume.value = -18;

    // Warm chord pad for results
    pad = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 2.2,
      oscillator: { type: "sine" },
      envelope: { attack: 0.02, decay: 0.5, sustain: 0.25, release: 1.4 },
      modulationEnvelope: { attack: 0.05, decay: 0.3, sustain: 0.1, release: 0.5 },
    }).connect(bus);
    pad.volume.value = -14;

    // Low tone for misses / the final swell
    low = new Tone.FMSynth({
      harmonicity: 1.4,
      modulationIndex: 3,
      oscillator: { type: "sine" },
      envelope: { attack: 0.03, decay: 1.6, sustain: 0.05, release: 1.4 },
    }).connect(bus);
    low.volume.value = -10;

    // Breathy air layer for the final seconds
    airFilter = new Tone.Filter({ type: "bandpass", frequency: 700, Q: 1.2 }).connect(reverb);
    air = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.18, decay: 0.5, sustain: 0 },
    }).connect(airFilter);
    air.volume.value = -30;

    ready = true;
  }

  function setMuted(m) { muted = m; }
  const off = () => !ready || muted;

  // Aeolian-flavoured ascent — tension without an alarm-clock feel
  const ASCENT = ["D4", "F4", "G4", "A4", "C5", "D5", "F5", "G5", "A5", "C6"];
  // An octave above where these started: down at D1 the pulse was felt
  // more than heard, and drowned the bell.
  const SUBS   = ["D2", "D2", "F2", "F2", "G2", "G2", "A2", "A2", "A2", "A2"];

  function tick(sec) {
    if (off()) return;
    const now = Tone.now();

    if (sec > 10) {
      // Quiet pendulum, alternating micro-detune so it breathes
      tockFilter.frequency.value = sec % 2 === 0 ? 1200 : 1050;
      tock.triggerAttackRelease("32n", now, 0.7);
      return;
    }

    const i = 10 - sec;                 // 0 … 9
    const t = i / 9;                    // 0 … 1
    bell.volume.value = -16 + t * 8;    // swell
    sub.volume.value  = -24 + t * 8;

    bell.triggerAttackRelease(ASCENT[i], 0.42, now);
    sub.triggerAttackRelease(SUBS[i], 0.2, now);

    // Heartbeat second thump tightens as time runs out
    if (sec <= 5) {
      const gap = 0.32 - (5 - sec) * 0.035;
      sub.triggerAttackRelease(SUBS[i], 0.18, now + gap);
    }
    if (sec <= 3) {
      air.volume.value = -32 + (3 - sec) * 3;
      air.triggerAttackRelease(0.5, now);
    }
  }

  // Three reels of decelerating mechanical clicks, each ending on a clunk.
  // Timings mirror the CSS delays/durations in SlotNumber.
  function reels() {
    if (off()) return;
    const now = Tone.now();
    const oldTock = tock.volume.value;
    tock.volume.value = -18;

    // The reels overlap in time, but `tock` is a single monophonic voice and
    // Tone rejects any event scheduled before the previous one. So gather
    // every click from all three reels first, then play them in time order.
    const clicks = [];
    for (let r = 0; r < 3; r++) {
      const start = r * 0.20;
      const dur = 0.9 + r * 0.22;
      let t = 0, gap = 0.028;
      while (t < dur) {
        clicks.push(start + t);
        t += gap;
        gap *= 1.075;                   // slows as the reel loses momentum
      }
    }
    clicks.sort((a, b) => a - b);

    let last = -1;
    for (const c of clicks) {
      const at = Math.max(c, last + 0.004);   // keep them strictly increasing
      tock.triggerAttackRelease("64n", now + at, 0.72);
      last = at;
    }

    // Each reel lands on a click, not a drum. The pitched sub hits that
    // used to be here were the loudest thing in the app.
    for (const at of [1.45, 1.92, 2.39]) {
      tile.triggerAttackRelease("32n", now + at, 0.7);
    }

    // Restore the pendulum's level once the reels are done.
    setTimeout(() => { if (ready) tock.volume.value = oldTock; }, 2000);
  }

  function timeUp() {
    if (off()) return;
    const now = Tone.now();
    low.triggerAttackRelease("D3", 1.5, now);
    pad.triggerAttackRelease(["D3", "A3", "D4"], 1.35, now);
    air.volume.value = -24;
    air.triggerAttackRelease(0.8, now);
  }

  function click(calculated) {
    if (off()) return;
    tile.triggerAttackRelease(calculated ? "16n" : "32n", Tone.now(), 0.62);
  }
  // One per tile as the six are dealt, so they no longer land in silence.
  function tileDrop() {
    if (off()) return;
    tile.triggerAttackRelease("32n", Tone.now(), 0.68);
  }
  function operatorClick() {
    if (off()) return;
    tile.triggerAttackRelease("32n", Tone.now(), 0.58);
  }
  function undo() {
    if (off()) return;
    const now = Tone.now();
    tile.triggerAttackRelease("32n", now, 0.62);
    tile.triggerAttackRelease("32n", now + 0.08, 0.48);
  }
  function calcDone(hit) {
    if (off()) return;
    const now = Tone.now();
    if (hit) {
      bell.volume.value = -10;
      bell.triggerAttackRelease("D5", 0.35, now);
      bell.triggerAttackRelease("A5", 0.35, now + 0.11);
      bell.triggerAttackRelease("D6", 0.75, now + 0.22);
    } else {
      bell.volume.value = -19;
      bell.triggerAttackRelease("A4", 0.2, now);
    }
  }
  function success() {
    if (off()) return;
    const now = Tone.now();
    pad.triggerAttackRelease(["D4", "A4", "D5"], 0.45, now);
    pad.triggerAttackRelease(["F4", "C5", "F5"], 0.45, now + 0.28);
    pad.triggerAttackRelease(["G4", "D5", "G5"], 1.35, now + 0.56);
    bell.volume.value = -13;
    bell.triggerAttackRelease("D6", 1.1, now + 0.56);
  }
  function nearMiss() {
    if (off()) return;
    const now = Tone.now();
    pad.triggerAttackRelease(["D4", "G4", "C5"], 0.9, now);
    bell.volume.value = -17;
    bell.triggerAttackRelease("G5", 0.55, now + 0.1);
  }
  function fail() {
    if (off()) return;
    const now = Tone.now();
    low.triggerAttackRelease("D3", 0.9, now);
    pad.triggerAttackRelease(["D3", "F3"], 0.85, now + 0.05);
  }
  function reveal() {
    if (off()) return;
    const now = Tone.now();
    tile.triggerAttackRelease("32n", now, 0.52);
    tile.triggerAttackRelease("32n", now + 0.09, 0.58);
    tile.triggerAttackRelease("32n", now + 0.18, 0.66);
  }

  // Audio is decoration. A fault in here must never stop the game — most
  // importantly, `reels` gates the start of the clock.
  const safe = (fn) => (...args) => {
    try { return fn(...args); } catch (_) { /* ignore */ }
  };
  const safeInit = async () => {
    try { await init(); } catch (_) { ready = false; }
  };

  return {
    init: safeInit,
    tick: safe(tick), reels: safe(reels), tileDrop: safe(tileDrop),
    timeUp: safe(timeUp),
    click: safe(click), operatorClick: safe(operatorClick), undo: safe(undo),
    calcDone: safe(calcDone), success: safe(success), nearMiss: safe(nearMiss),
    fail: safe(fail), reveal: safe(reveal), setMuted,
  };
})();
