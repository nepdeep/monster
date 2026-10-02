// The picture-only interface: category tabs, the big option buttons, undo,
// shuffle, mute, calm motion, the stage button, the wish bubble and the
// sticker screen. Text appears only in aria-labels for assistive tech.

import { CATEGORIES, OPTIONS } from './catalog.js';
import { ICONS } from './icons.js';
import { settings } from './util.js';

const $ = (sel) => document.querySelector(sel);

export class UI {
  constructor(pictures, handlers) {
    this.pictures = pictures;
    this.h = handlers;
    this.category = 'color';
    this.outfit = null;
    this.wish = null;

    this.tabs = $('#tabs');
    this.tray = $('#tray');
    this.undoBtn = $('#undo');
    this.shuffleBtn = $('#shuffle');
    this.muteBtn = $('#mute');
    this.motionBtn = $('#motion');
    this.stageBtn = $('#stage-btn');
    this.wishBtn = $('#wish');
    this.sticker = $('#sticker-screen');

    this.undoBtn.innerHTML = ICONS.undo;
    this.shuffleBtn.innerHTML = ICONS.shuffle;
    this.stageBtn.innerHTML = ICONS.stage;
    $('#again').innerHTML = ICONS.again;
    $('#new-friend').innerHTML = ICONS.newFriend;
    $('#heart-burst').innerHTML = ICONS.heart;

    const tabPics = { color: null, hat: pictures.hat.star, wings: pictures.wings.butterfly, shoes: pictures.shoes.sneakers, hair: pictures.hair.puff };
    for (const cat of CATEGORIES) {
      const b = document.createElement('button');
      b.className = 'tab';
      b.dataset.category = cat.id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', cat.label);
      b.innerHTML = cat.id === 'color' ? ICONS.palette : `<img alt="" draggable="false" src="${tabPics[cat.id]}">`;
      b.addEventListener('click', () => {
        this.h.tap();
        this.openCategory(cat.id);
      });
      this.tabs.appendChild(b);
    }

    this.undoBtn.addEventListener('click', () => this.h.undo());
    this.shuffleBtn.addEventListener('click', () => this.h.shuffle());
    this.stageBtn.addEventListener('click', () => this.h.stage());
    this.wishBtn.addEventListener('click', () => this.h.wishTapped());
    this.muteBtn.addEventListener('click', () => this.h.toggleMute());
    this.motionBtn.addEventListener('click', () => this.h.toggleMotion());
    $('#again').addEventListener('click', () => this.h.keepDecorating());
    $('#new-friend').addEventListener('click', () => this.h.newFriend());

    this.refreshToggles();
    this.openCategory('color');
  }

  openCategory(cat) {
    this.category = cat;
    for (const t of this.tabs.children) {
      const on = t.dataset.category === cat;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    }
    this.tray.replaceChildren();
    this.tray.dataset.category = cat;
    for (const opt of OPTIONS[cat]) {
      const b = document.createElement('button');
      b.className = 'option';
      b.dataset.category = cat;
      b.dataset.id = opt.id;
      b.setAttribute('aria-label', opt.label);
      b.innerHTML = `<img alt="" draggable="false" src="${this.pictures[cat][opt.id]}">`;
      b.addEventListener('click', () => this.h.choose(cat, opt.id));
      this.tray.appendChild(b);
    }
    this.tray.classList.remove('swap');
    void this.tray.offsetWidth;
    this.tray.classList.add('swap');
    this.refreshSelection();
  }

  setOutfit(outfit, canUndo) {
    this.outfit = outfit;
    this.undoBtn.disabled = !canUndo;
    this.refreshSelection();
  }

  refreshSelection() {
    if (!this.outfit) return;
    for (const b of this.tray.children) {
      const selected = this.outfit[b.dataset.category] === b.dataset.id;
      b.classList.toggle('selected', selected);
      b.setAttribute('aria-pressed', String(selected));
      b.classList.toggle('wished', !!this.wish && this.wish.category === b.dataset.category && this.wish.id === b.dataset.id);
    }
    for (const t of this.tabs.children) {
      t.classList.toggle('wished', !!this.wish && this.wish.category === t.dataset.category);
    }
  }

  setWish(wish) {
    this.wish = wish;
    if (wish) {
      this.wishBtn.querySelector('img').src = this.pictures[wish.category][wish.id];
      this.wishBtn.setAttribute('aria-label', `Your monster would love: ${OPTIONS[wish.category].find((o) => o.id === wish.id).label}`);
      this.wishBtn.classList.add('show');
    } else {
      this.wishBtn.classList.remove('show');
    }
    this.refreshSelection();
  }

  placeWish(x, y) {
    this.wishBtn.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  heartBurst(x, y) {
    const el = $('#heart-burst');
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
  }

  pulse(el) {
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  }

  refreshToggles() {
    this.muteBtn.innerHTML = settings.muted ? ICONS.soundOff : ICONS.soundOn;
    this.muteBtn.setAttribute('aria-pressed', String(settings.muted));
    this.muteBtn.setAttribute('aria-label', settings.muted ? 'Sound is off. Turn sound on' : 'Sound is on. Turn sound off');
    this.motionBtn.innerHTML = settings.reducedMotion ? ICONS.motionOff : ICONS.motionOn;
    this.motionBtn.setAttribute('aria-pressed', String(settings.reducedMotion));
    this.motionBtn.setAttribute('aria-label', settings.reducedMotion ? 'Calm motion is on. Turn it off' : 'Calm motion is off. Turn it on');
    document.body.classList.toggle('calm', settings.reducedMotion);
  }

  setMode(mode) {
    document.body.dataset.mode = mode;
  }

  showSticker(url) {
    $('#sticker-img').src = url;
    this.sticker.hidden = false;
    this.sticker.classList.remove('in');
    void this.sticker.offsetWidth;
    this.sticker.classList.add('in');
  }

  hideSticker() {
    this.sticker.hidden = true;
    this.sticker.classList.remove('in');
  }

  flash() {
    const f = $('#flash');
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
  }

  /** Screen-space rectangle that the 3D view should keep the action inside. */
  freeArea() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const tabs = this.tabs.getBoundingClientRect();
    const tray = this.tray.getBoundingClientRect();
    const portrait = W < H;
    if (portrait) {
      return { left: 0, right: 0, top: 64, bottom: H - Math.min(tabs.top, tray.top) + 4, portrait };
    }
    return { left: tabs.right + 6, right: 0, top: 0, bottom: H - tray.top + 4, portrait };
  }
}
