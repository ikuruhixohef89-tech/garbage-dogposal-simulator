// HUD: buttons (pause, sound, fullscreen), the shift card (day, recipe, portions),
// stats (timer, score, strikes), a toast, and the SOUS-AI line at the bottom.

import { ICONS, strikeIcon } from './icons.js';
import { isFullscreen } from '../core/viewport.js';
import { S } from '../strings.js';

export function createHud({ onPause, onMute, onFullscreen }) {
  const $ = id => document.getElementById(id);
  const btnPause = $('btn-pause');
  const btnMute = $('btn-mute');
  const btnFs = $('btn-fs');
  const toastEl = $('toast');
  const card = $('hud-card');
  const stats = $('hud-stats');
  const el = { day: $('hud-day'), recipe: $('hud-recipe'), portions: $('hud-portions'), timer: $('hud-timer'), score: $('hud-score'), strikes: $('hud-strikes') };
  const ai = $('ai-line');
  let toastTimer = 0;
  let aiTimer = 0;
  let aiUntil = 0;
  let aiPriority = 0;
  const lastVals = {};

  btnPause.innerHTML = ICONS.pause;
  // After a mouse/touch click the button lets go of focus, so Space keeps chopping
  // instead of toggling the sound again (keyboard activation keeps focus: e.detail is 0).
  const onClick = fn => e => {
    fn();
    if (e.detail > 0) e.currentTarget.blur();
  };
  btnPause.addEventListener('click', onClick(onPause));
  btnMute.addEventListener('click', onClick(onMute));
  btnFs.addEventListener('click', onClick(onFullscreen));

  const syncFs = () => {
    btnFs.innerHTML = isFullscreen() ? ICONS.fullscreenExit : ICONS.fullscreen;
  };
  syncFs();
  document.addEventListener('fullscreenchange', syncFs);
  document.addEventListener('webkitfullscreenchange', syncFs);

  const set = (key, html, asHtml = false) => {
    if (lastVals[key] === html) return;
    lastVals[key] = html;
    if (asHtml) el[key].innerHTML = html;
    else el[key].textContent = html;
  };

  return {
    setMuted(m) {
      btnMute.innerHTML = m ? ICONS.soundOff : ICONS.soundOn;
      btnMute.setAttribute('aria-pressed', m ? 'false' : 'true');
    },
    setFullscreenAvailable(ok) {
      btnFs.hidden = !ok;
    },
    setInGame(on) {
      btnPause.hidden = !on;
      card.hidden = !on;
      stats.hidden = !on;
    },
    update(h) {
      set('day', h.day);
      set('recipe', h.recipe);
      set('portions', S.portions(h.portions, h.total));
      const m = Math.floor(h.timer / 60);
      const s = String(h.timer % 60).padStart(2, '0');
      set('timer', `${m}:${s}`);
      el.timer.classList.toggle('low', h.timer <= 10);
      set('score', String(h.score));
      set('strikes', [0, 1, 2].map(i => strikeIcon(i < h.strikes)).join(''), true);
    },
    toast(text, ms = 2200) {
      toastEl.textContent = text;
      toastEl.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
    },
    // priority: 0 jokes, 1 vet facts, 2 strike-out. A lower line never cuts a higher one short.
    aiLine(text, ms = 1800, priority = 0) {
      const now = performance.now();
      if (now < aiUntil && priority < aiPriority) return;
      aiPriority = priority;
      aiUntil = now + ms;
      ai.textContent = `SOUS-AI: ${text}`;
      ai.classList.add('show');
      clearTimeout(aiTimer);
      aiTimer = setTimeout(() => ai.classList.remove('show'), ms);
    },
    clearAi() {
      ai.classList.remove('show');
      aiUntil = 0;
      aiPriority = 0;
    },
  };
}
