// Settings and records on this device only: one localStorage key, numbers and score lists only.
// Records: the best scores per mode and level (top 5). Settings: sound, chosen skin, hints, tutorial flags.
// In a cross-site iframe localStorage may throw, so every access is wrapped and falls back to memory.

import { STORAGE_KEY } from '../config.js';

const DEFAULTS = { v: 1, muted: 0, best: 0, bestStars: 0, tutorialDone: 0, hints: 0, skin: 0 };
const TOP_SIZE = 5;
const TOP_KEY = /^(sort|rush):(mon|wed|fri|run)$/;
let mem = { ...DEFAULTS, top: {} };
let available = false;

function sanitizeTop(top) {
  const out = {};
  if (!top || typeof top !== 'object') return out;
  for (const [k, list] of Object.entries(top)) {
    if (!TOP_KEY.test(k) || !Array.isArray(list)) continue;
    out[k] = list
      .map(Number)
      .filter(n => Number.isFinite(n) && n >= 0)
      .map(n => Math.floor(n))
      .sort((a, b) => b - a)
      .slice(0, TOP_SIZE);
  }
  return out;
}

function sanitize(obj) {
  const out = {};
  for (const k of Object.keys(DEFAULTS)) {
    if (!(k in obj)) continue;
    const n = Number(obj[k]);
    if (Number.isFinite(n) && n >= 0) out[k] = Math.floor(n);
  }
  if ('top' in obj) out.top = sanitizeTop(obj.top);
  return out;
}

function write() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mem));
    available = true;
  } catch (e) {
    available = false;
  }
}

export function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    available = true;
    if (raw) mem = { ...DEFAULTS, top: {}, ...sanitize(JSON.parse(raw)), v: 1 };
  } catch (e) {
    available = false;
  }
  return get();
}

export function save(patch) {
  mem = { ...mem, ...sanitize(patch), v: 1 };
  write();
  return get();
}

export function get() {
  return { ...mem, top: { ...mem.top } };
}

// Adds a score to the top list of mode:level. Returns its place (1..5), or 0 if it did not make the list.
export function addTop(mode, level, score) {
  const key = `${mode}:${level}`;
  if (!TOP_KEY.test(key) || !(score > 0)) return 0;
  const list = (mem.top[key] || []).slice();
  list.push(Math.floor(score));
  list.sort((a, b) => b - a);
  const place = list.indexOf(Math.floor(score)) + 1;
  mem.top = { ...mem.top, [key]: list.slice(0, TOP_SIZE) };
  write();
  return place <= TOP_SIZE ? place : 0;
}

export function topFor(mode, level) {
  return (mem.top[`${mode}:${level}`] || []).slice();
}

export function isAvailable() {
  return available;
}
