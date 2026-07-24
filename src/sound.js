import * as Tone from "tone";

// ── Sound Engine ───────────────────────────────────────────────
// Warm, acoustic-leaning palette: plucked strings, struck bells,
// felt-damped low pulses. No square waves, no chiptune.
export const Sound = (() => {
  let ready = false;
  let muted = false;
  let reverb, room, bus;
  let tock, tockFilter, bell, sub, pluck, pad, low, air, airFilter;

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
    tock.volume.value = -14;

    // Struck bell — FM with inharmonic ratio, long soft tail
    bell = new Tone.FMSynth({
      harmonicity: 2.6,
      modulationIndex: 5.5,
      oscillator: { type: "sine" },
      modulation: { type: "sine" },
      envelope: { attack: 0.004, decay: 1.1, sustain: 0, release: 0.9 },
      modulationEnvelope: { attack: 0.002, decay: 0.22, sustain: 0, release: 0.2 },
    }).connect(bus);
    bell.volume.value = -10;

    // Felt-damped sub pulse — the "heartbeat"
    sub = new Tone.MembraneSynth({
      pitchDecay: 0.09,
      octaves: 1.6,
      oscillator: { type: "sine" },
      envelope: { attack: 0.002, decay: 0.42, sustain: 0, release: 0.2 },
    }).connect(room);
    sub.volume.value = -12;

    // Plucked string for taps
    pluck = new Tone.PluckSynth({
      attackNoise: 0.6, dampening: 3600, resonance: 0.86,
    }).connect(room);
    pluck.volume.value = -8;

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
  const SUBS   = ["D1", "D1", "F1", "F1", "G1", "G1", "A1", "A1", "A1", "A1"];

  function tick(sec) {
    if (off()) return;
    const now = Tone.now();

    if (sec > 10) {
      // Quiet pendulum, alternating micro-detune so it breathes
      tockFilter.frequency.value = sec % 2 === 0 ? 1150 : 980;
      tock.triggerAttackRelease("32n", now);
      return;
    }

    const i = 10 - sec;                 // 0 … 9
    const t = i / 9;                    // 0 … 1
    bell.volume.value = -14 + t * 10;   // swell
    sub.volume.value  = -16 + t * 10;

    bell.triggerAttackRelease(ASCENT[i], 0.5, now);
    sub.triggerAttackRelease(SUBS[i], 0.3, now);

    // Heartbeat second thump tightens as time runs out
    if (sec <= 6) {
      const gap = 0.34 - (6 - sec) * 0.035;
      sub.triggerAttackRelease(SUBS[i], 0.25, now + gap);
    }
    if (sec <= 4) {
      air.volume.value = -30 + (4 - sec) * 5;
      air.triggerAttackRelease(0.7, now);
    }
  }

  // Three reels of decelerating mechanical clicks, each ending on a clunk.
  // Timings mirror the CSS delays/durations in SlotNumber.
  function reels() {
    if (off()) return;
    const now = Tone.now();
    const oldTock = tock.volume.value;
    tock.volume.value = -19;

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
      tock.triggerAttackRelease("64n", now + at);
      last = at;
    }

    // Landing clunks, pitched up a little for each successive reel.
    sub.volume.value = -10;
    for (let r = 0; r < 3; r++) {
      sub.triggerAttackRelease(
        ["D2", "E2", "G2"][r], 0.2,
        now + r * 0.20 + 0.9 + r * 0.22
      );
    }

    // Restore the pendulum's level once the reels are done.
    setTimeout(() => { if (ready) tock.volume.value = oldTock; }, 2000);
  }

  function timeUp() {
    if (off()) return;
    const now = Tone.now();
    low.triggerAttackRelease("D2", 2.2, now);
    pad.triggerAttackRelease(["D3", "A3", "D4"], 1.8, now);
    air.volume.value = -18;
    air.triggerAttackRelease(1.2, now);
  }

  function click(calculated) {
    if (off()) return;
    pluck.triggerAttackRelease(calculated ? "A4" : "D4", "8n");
  }
  function operatorClick() {
    if (off()) return;
    pluck.triggerAttackRelease("G3", "8n");
  }
  function undo() {
    if (off()) return;
    const now = Tone.now();
    pluck.triggerAttackRelease("F3", "8n", now);
    pluck.triggerAttackRelease("D3", "8n", now + 0.07);
  }
  function calcDone(hit) {
    if (off()) return;
    const now = Tone.now();
    if (hit) {
      bell.volume.value = -8;
      bell.triggerAttackRelease("D5", 0.4, now);
      bell.triggerAttackRelease("A5", 0.4, now + 0.11);
      bell.triggerAttackRelease("D6", 0.9, now + 0.22);
    } else {
      bell.volume.value = -18;
      bell.triggerAttackRelease("A4", 0.25, now);
    }
  }
  function success() {
    if (off()) return;
    const now = Tone.now();
    pad.triggerAttackRelease(["D4", "A4", "D5"], 0.5, now);
    pad.triggerAttackRelease(["F4", "C5", "F5"], 0.5, now + 0.28);
    pad.triggerAttackRelease(["G4", "D5", "G5"], 1.6, now + 0.56);
    bell.volume.value = -12;
    bell.triggerAttackRelease("D6", 1.4, now + 0.56);
  }
  function nearMiss() {
    if (off()) return;
    const now = Tone.now();
    pad.triggerAttackRelease(["D4", "G4", "C5"], 1.1, now);
    bell.volume.value = -16;
    bell.triggerAttackRelease("G5", 0.7, now + 0.1);
  }
  function fail() {
    if (off()) return;
    const now = Tone.now();
    low.triggerAttackRelease("D2", 1.4, now);
    pad.triggerAttackRelease(["D3", "F3"], 1.2, now + 0.05);
  }
  function reveal() {
    if (off()) return;
    const now = Tone.now();
    pluck.triggerAttackRelease("D4", "8n", now);
    pluck.triggerAttackRelease("A4", "8n", now + 0.09);
    pluck.triggerAttackRelease("D5", "8n", now + 0.18);
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
    tick: safe(tick), reels: safe(reels), timeUp: safe(timeUp),
    click: safe(click), operatorClick: safe(operatorClick), undo: safe(undo),
    calcDone: safe(calcDone), success: safe(success), nearMiss: safe(nearMiss),
    fail: safe(fail), reveal: safe(reveal), setMuted,
  };
})();
