// DOM overlays: title, pause, shift card, shift end, Unit Report, Dog Menu. Text comes from strings.js only.

import { S } from '../strings.js';
import { starIcon } from './icons.js';
import { allPieceTypes } from '../food/ingredients.js';

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function fillStrings(root) {
  root.querySelectorAll('[data-str]').forEach(el => {
    const v = S[el.getAttribute('data-str')];
    if (typeof v === 'string') el.textContent = v;
  });
  root.querySelectorAll('[data-aria]').forEach(el => {
    const v = S[el.getAttribute('data-aria')];
    if (typeof v === 'string') {
      el.setAttribute('aria-label', v);
      el.setAttribute('title', v);
    }
  });
}

// getTop(mode, level) -> scores; getSkins() -> { list, best, current }; onSkin(index).
export function createScreens({ onPlay, onPlayRush, onTraining, onResume, onToggleSound, onHideUi, onRestart, onAgain, onMenu, getTop, getSkins, onSkin }) {
  const $ = id => document.getElementById(id);
  const title = $('title');
  const pause = $('pause');
  const play = $('play');
  const pauseSub = $('pause-sub');
  const resume = $('btn-resume');
  const sound = $('btn-sound');
  const iosNote = $('ios-note');
  const card = $('card');
  const shiftEnd = $('shiftend');
  const report = $('report');
  const dogMenu = $('dogmenu');
  const cards = $('cards');
  const cardsList = $('cards-list');
  let cardDone = null;
  let cardPick = null; // { list, onPick, openedAt }

  play.addEventListener('click', onPlay);
  $('play-rush').addEventListener('click', onPlayRush);
  $('btn-training').addEventListener('click', onTraining);
  const recordsEl = $('records');
  const skinsEl = $('skinsel');
  $('btn-records').addEventListener('click', () => api.openRecords('sort'));
  $('rec-sort').addEventListener('click', () => api.openRecords('sort'));
  $('rec-rush').addEventListener('click', () => api.openRecords('rush'));
  $('btn-records-close').addEventListener('click', () => {
    recordsEl.hidden = true;
    play.focus({ preventScroll: true });
  });
  $('btn-skins').addEventListener('click', () => api.openSkins());
  $('btn-skins-close').addEventListener('click', () => {
    skinsEl.hidden = true;
    play.focus({ preventScroll: true });
  });
  for (const el of [recordsEl, skinsEl]) {
    el.addEventListener('click', e => {
      if (e.target === el) el.hidden = true;
    });
  }
  resume.addEventListener('click', onResume);
  sound.addEventListener('click', onToggleSound);
  $('btn-hide').addEventListener('click', onHideUi);
  $('btn-restart').addEventListener('click', onRestart);
  $('btn-again').addEventListener('click', onAgain);
  $('btn-menu').addEventListener('click', onMenu);
  $('btn-report-menu').addEventListener('click', onMenu);
  $('btn-dogmenu').addEventListener('click', () => {
    dogMenu.hidden = false;
    $('btn-dogmenu-close').focus({ preventScroll: true });
  });
  $('btn-dogmenu-close').addEventListener('click', () => {
    dogMenu.hidden = true;
    resume.focus({ preventScroll: true });
  });
  // Tapping the dimmed area around the Dog Menu closes it.
  dogMenu.addEventListener('click', e => {
    if (e.target === dogMenu) {
      dogMenu.hidden = true;
      resume.focus({ preventScroll: true });
    }
  });
  // Tapping the dimmed area outside the panel also continues the game.
  pause.addEventListener('click', e => {
    if (e.target === pause) onResume();
  });
  card.addEventListener('click', () => api.skipCard());
  if (isIOS()) iosNote.hidden = false;

  // Dog Menu content from the verified food table.
  const seen = new Set();
  for (const t of allPieceTypes()) {
    const key = `${t.kind === 'dish' || t.kind === 'spare' ? t.ingredient : t.itemId}:${t.cat}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const li = document.createElement('li');
    li.textContent = t.kind === 'dish' || t.kind === 'spare' ? t.label.replace(/, sliced$/, '').replace(/^Spare piece of /, '') : t.label;
    const list = t.cat === 'ok' ? 'dm-ok' : t.cat === 'toxic' ? 'dm-no' : 'dm-bin';
    if ([...$(list).children].some(x => x.textContent.toLowerCase() === li.textContent.toLowerCase())) continue;
    $(list).appendChild(li);
  }

  const api = {
    showTitle(on) {
      title.hidden = !on;
      if (on) play.focus({ preventScroll: true });
    },
    setTitleBest(text) {
      const el = $('title-best');
      el.hidden = !text;
      el.textContent = text || '';
    },
    showPause(reason) {
      pauseSub.textContent = reason === 'visibility' ? S.tapToContinue : S.pausedSub;
      pause.hidden = false;
      resume.focus({ preventScroll: true });
    },
    hidePause() {
      pause.hidden = true;
      dogMenu.hidden = true;
    },
    get pauseOpen() {
      return !pause.hidden;
    },
    get overlayOpen() {
      return !card.hidden || !shiftEnd.hidden || !report.hidden;
    },
    setSoundLabel(muted) {
      sound.textContent = muted ? S.soundOff : S.soundOn;
      sound.setAttribute('aria-pressed', muted ? 'false' : 'true');
    },
    shiftCard(info, onDone) {
      $('card-ai').textContent = info.header;
      $('card-title').textContent = S.shiftOf(info.day, info.name);
      $('card-joke').textContent = info.joke;
      $('card-new').hidden = !info.newNo.length;
      $('card-new-list').textContent = info.newNo.join(' · ');
      card.hidden = false;
      cardDone = onDone;
      // The session closes the card on game time (so pause stops it); a tap closes it earlier.
      return info.short ? 1.4 : info.newNo.length ? 3.4 : 2.6;
    },
    skipCard() {
      if (card.hidden) return;
      card.hidden = true;
      const f = cardDone;
      cardDone = null;
      if (f) f();
    },
    shiftEnd(info) {
      $('se-title').textContent = S.shiftDone(info.day);
      $('se-place').hidden = !info.place;
      $('se-place').textContent = info.place ? S.place(info.place, info.day) : '';
      $('se-stars').innerHTML = [0, 1, 2].map(i => starIcon(i < info.stars, 44)).join('');
      shiftEnd.hidden = false;
    },
    hideShiftEnd() {
      shiftEnd.hidden = true;
    },
    report(d) {
      $('report-stars').innerHTML = Array.from({ length: d.maxStars }, (_, i) => starIcon(i < d.stars, 28)).join('');
      $('report-rank').textContent = d.rank;
      const extra = [d.place ? S.placeRun(d.place) : '', d.unlocks && d.unlocks.length ? S.unlocked(d.unlocks.join(', ')) : ''].filter(Boolean).join(' · ');
      $('report-extra').hidden = !extra;
      $('report-extra').textContent = extra;
      const rows = [
        [S.reportScore, String(d.score) + (d.newBest ? ` · ${S.newBest}` : '')],
        [S.reportBest, d.hadBest || d.newBest ? String(d.best) : S.reportNoRecord],
        [S.reportStars, `${d.stars}/${d.maxStars}`],
        [S.reportSlices, String(d.slices)],
        [S.reportBestMulti, String(d.bestMulti)],
        [S.reportTreats, String(d.treats)],
        [S.reportLeft, String(d.leftAlone)],
        [S.reportResisted, String(d.resisted)],
        [S.reportSaves, String(d.saves)],
      ];
      const list = $('report-list');
      list.textContent = '';
      for (const [k, v] of rows) {
        const dt = document.createElement('dt');
        dt.textContent = k;
        const dd = document.createElement('dd');
        dd.textContent = v;
        list.append(dt, dd);
      }
      report.hidden = false;
      $('btn-again').focus({ preventScroll: true });
    },
    // Upgrade cards. A tap in the first 0.5 s is ignored: it is probably the end of a swipe.
    cards(list, onPick) {
      cardsList.textContent = '';
      list.forEach((c, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'card-btn';
        const h = document.createElement('h3');
        h.textContent = c.title;
        const p = document.createElement('p');
        p.textContent = c.short;
        b.append(h, p);
        if (c.rare) {
          const r = document.createElement('span');
          r.className = 'tag-rare';
          r.textContent = S.rare;
          b.append(r);
        }
        const k = document.createElement('span');
        k.className = 'card-key';
        k.textContent = String(i + 1);
        b.append(k);
        b.addEventListener('click', () => api.pickCard(i));
        cardsList.append(b);
      });
      cardPick = { list, onPick, openedAt: performance.now() };
      cards.hidden = false;
    },
    pickCard(i) {
      if (!cardPick || cards.hidden || performance.now() - cardPick.openedAt < 500) return;
      const c = cardPick.list[i];
      if (!c) return;
      const f = cardPick.onPick;
      cardPick = null;
      cards.hidden = true;
      f(c.id);
    },
    get cardsOpen() {
      return !cards.hidden;
    },
    hideGameOverlays() {
      card.hidden = true;
      shiftEnd.hidden = true;
      report.hidden = true;
      cards.hidden = true;
      cardDone = null;
      cardPick = null;
    },
    // Records: the top scores of one mode, per level and for the whole run.
    openRecords(mode) {
      $('rec-sort').setAttribute('aria-pressed', mode === 'sort' ? 'true' : 'false');
      $('rec-rush').setAttribute('aria-pressed', mode === 'rush' ? 'true' : 'false');
      const table = $('records-table');
      table.textContent = '';
      for (const [level, name] of [['mon', 'MON'], ['wed', 'WED'], ['fri', 'FRI'], ['run', S.recordsRun]]) {
        const col = document.createElement('div');
        const h = document.createElement('h3');
        h.textContent = name;
        const ol = document.createElement('ol');
        const list = getTop ? getTop(mode, level) : [];
        for (let i = 0; i < 5; i++) {
          const li = document.createElement('li');
          li.textContent = list[i] != null ? String(list[i]) : S.recordsEmpty;
          ol.append(li);
        }
        col.append(h, ol);
        table.append(col);
      }
      recordsEl.hidden = false;
      $('btn-records-close').focus({ preventScroll: true });
    },
    openSkins() {
      const { list, best, current } = getSkins ? getSkins() : { list: [], best: 0, current: 0 };
      const box = $('skins-list');
      box.textContent = '';
      list.forEach((s, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'skin-btn';
        const sw = document.createElement('span');
        sw.className = 'swatch';
        sw.style.background = s.bandana[0];
        const name = document.createElement('b');
        name.textContent = s.name;
        const note = document.createElement('small');
        const open = best >= s.need;
        note.textContent = !open ? S.skinNeed(s.need) : i === current ? S.skinOn : '';
        b.append(sw, name, note);
        b.disabled = !open;
        b.setAttribute('aria-pressed', i === current ? 'true' : 'false');
        b.addEventListener('click', () => {
          if (onSkin) onSkin(i);
          api.openSkins();
        });
        box.append(b);
      });
      skinsEl.hidden = false;
      $('btn-skins-close').focus({ preventScroll: true });
    },
    get reportOpen() {
      return !report.hidden;
    },
  };
  return api;
}
