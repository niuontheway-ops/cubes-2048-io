'use strict';
/* ============================================================
 * UI - HUD / 摇杆 / 技能按钮 / 排行榜 / 浮层 / 输入
 * ============================================================ */
const UI = {
  el: {},
  joy: { active: false, id: -1, kx: 0, ky: 0, baseX: 0, baseY: 0, R: 56 },
  keys: {},
  mouseDir: null,
  boostHeld: false,
  _lbTimer: 0,
  _hudTimer: 0,

  init() {
    const $ = function (id) { return document.getElementById(id); };
    const E = this.el;
    E.canvas = $('game');
    E.score = $('scoreVal'); E.headChip = $('headChip'); E.lenChip = $('lenChip');
    E.bestChip = $('bestVal'); E.board = $('boardRows');
    E.toastWrap = $('toastWrap'); E.killfeed = $('killfeed');
    E.joyZone = $('joyZone'); E.joyBase = $('joyBase'); E.joyKnob = $('joyKnob');
    E.skillBar = $('skillBar');
    E.statusChips = $('statusChips');
    E.menu = $('menu'); E.dead = $('dead'); E.pause = $('pauseScr');
    E.countdown = $('countdown'); E.portrait = $('portrait');
    E.nameInput = $('nameInput');
    E.deadStats = $('deadStats');
    E.menuBest = $('menuBest');
    E.btnSound = $('btnSound'); E.btnMusic = $('btnMusic'); E.btnPause = $('btnPause');

    this.buildSkillButtons();
    this.bindJoystick();
    this.bindSkillButtons();
    this.bindKeyboard();
    this.bindMouse();
    this.bindButtons();

    // 竖屏提示
    window.addEventListener('resize', () => this.checkOrientation());
    this.checkOrientation();
    if (G.best > 0) E.menuBest.textContent = '历史最高：' + G.best;
  },

  /* ---------- 技能按钮 ---------- */
  buildSkillButtons() {
    const bar = this.el.skillBar;
    bar.innerHTML = '';
    const defs = [
      { key: 'boost', name: '加速', icon: 'bolt', color: '#ffd43b', fixed: true },
      { key: 'dash', name: SKILL_DEFS.dash.name, icon: 'chevron', color: SKILL_DEFS.dash.color },
      { key: 'ghost', name: SKILL_DEFS.ghost.name, icon: 'eye', color: SKILL_DEFS.ghost.color },
      { key: 'burn', name: SKILL_DEFS.burn.name, icon: 'flame', color: SKILL_DEFS.burn.color },
    ];
    this.btns = {};
    defs.forEach((d) => {
      const b = document.createElement('div');
      b.className = 'skillBtn' + (d.fixed ? ' fixed' : '');
      b.id = 'btn_' + d.key;
      b.innerHTML =
        '<div class="sbCd"></div>' +
        '<div class="sbIcon" style="color:' + d.color + '"></div>' +
        '<div class="sbName">' + d.name + '</div>' +
        '<div class="sbPips"></div>';
      bar.appendChild(b);
      this.btns[d.key] = { root: b, cd: b.querySelector('.sbCd'), icon: b.querySelector('.sbIcon'), pips: b.querySelector('.sbPips') };
      // 图标
      const ic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ic.setAttribute('viewBox', '0 0 24 24');
      ic.setAttribute('width', '26'); ic.setAttribute('height', '26');
      ic.innerHTML = this.iconPath(d.icon, d.color);
      b.querySelector('.sbIcon').appendChild(ic);
    });
  },
  iconPath(type, color) {
    const s = 'stroke="' + color + '" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"';
    if (type === 'bolt') return '<path d="M13 2 L5 13 h5 l-1 9 8-11 h-5 z" fill="' + color + '" stroke="none"/>';
    if (type === 'chevron') return '<path d="M5 5 L11 12 L5 19 M12 5 L18 12 L12 19" ' + s + '/>';
    if (type === 'eye') return '<path d="M2 12 Q6 5 12 5 Q18 5 22 12 Q18 19 12 19 Q6 19 2 12 Z" ' + s + '/><circle cx="12" cy="12" r="3" fill="' + color + '" stroke="none"/>';
    if (type === 'flame') return '<path d="M12 2 C14 6 18 8 18 13 A6 6 0 0 1 6 13 C6 8 10 6 12 2 Z" ' + s + '/><path d="M12 10 C13.5 12 14 13 14 14.5 A2 2 0 0 1 10 14.5 C10 13 10.5 12 12 10 Z" fill="' + color + '" stroke="none"/>';
    return '';
  },

  /* ---------- 摇杆(右手方向) ---------- */
  bindJoystick() {
    const zone = this.el.joyZone, base = this.el.joyBase, knob = this.el.joyKnob;
    const self = this;
    function layout() {
      const W = window.innerWidth, H = window.innerHeight;
      const bx = W - 96, by = H - 96;
      base.style.left = bx + 'px'; base.style.top = by + 'px';
      self.joy.baseX = bx; self.joy.baseY = by; self.joy.R = 56;
    }
    layout();
    window.addEventListener('resize', layout);

    zone.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return; // 桌面用鼠标转向
      e.preventDefault();
      self.joy.active = true; self.joy.id = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      self.moveKnob(e);
    });
    zone.addEventListener('pointermove', function (e) {
      if (!self.joy.active || e.pointerId !== self.joy.id) return;
      e.preventDefault();
      self.moveKnob(e);
    });
    function release(e) {
      if (e.pointerId !== self.joy.id) return;
      self.joy.active = false; self.joy.id = -1;
      knob.style.transform = 'translate(-50%,-50%)';
      knob.classList.remove('on');
      World.setPlayerDir(0, 0);
    }
    zone.addEventListener('pointerup', release);
    zone.addEventListener('pointercancel', release);
  },
  moveKnob(e) {
    const j = this.joy;
    let dx = e.clientX - j.baseX, dy = e.clientY - j.baseY;
    const d = Math.sqrt(dx * dx + dy * dy);
    const max = j.R - 18;
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    this.el.joyKnob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
    this.el.joyKnob.classList.add('on');
    World.setPlayerDir(dx / max, dy / max);
  },

  /* ---------- 技能按钮(左手) ---------- */
  bindSkillButtons() {
    const self = this;
    const P = World.player;
    function down(e) {
      e.preventDefault();
      const key = e.currentTarget.id.replace('btn_', '');
      if (G.state !== 'playing' || !World.player || !World.player.alive) return;
      if (key === 'boost') {
        self.boostHeld = true;
        setBoost(World.player, true);
        e.currentTarget.classList.add('on');
      } else if (key === 'dash') {
        if (tryDash(World.player)) flash(e.currentTarget);
      } else if (key === 'ghost') {
        if (tryGhost(World.player)) flash(e.currentTarget);
      } else if (key === 'burn') {
        if (tryBurn(World.player)) flash(e.currentTarget);
      }
    }
    function up(e) {
      const key = e.currentTarget.id.replace('btn_', '');
      if (key === 'boost') {
        self.boostHeld = false;
        setBoost(World.player, false);
        e.currentTarget.classList.remove('on');
      }
    }
    Object.keys(this.btns).forEach((k) => {
      const b = this.btns[k].root;
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    });
    function flash(el) {
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 300);
    }
  },

  /* ---------- 键盘(桌面调试) ---------- */
  bindKeyboard() {
    const self = this;
    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      self.keys[k] = true;
      if (k === ' ') {
        e.preventDefault();
        if (G.state === 'playing' && World.player && World.player.alive) {
          self.boostHeld = true;
          setBoost(World.player, true);
          self.btns.boost.root.classList.add('on');
        }
      }
      if (G.state !== 'playing') return;
      if (k === '1' || k === 'j') tryDash(World.player);
      if (k === '2' || k === 'k') tryGhost(World.player);
      if (k === '3' || k === 'l') tryBurn(World.player);
      if (k === 'escape' && G.state === 'playing') Game.pause();
    });
    window.addEventListener('keyup', function (e) {
      const k = e.key.toLowerCase();
      self.keys[k] = false;
      if (k === ' ') {
        self.boostHeld = false;
        if (World.player) setBoost(World.player, false);
        self.btns.boost.root.classList.remove('on');
      }
    });
  },

  /* ---------- 鼠标转向(桌面，贴近原版 PC 操作) ---------- */
  bindMouse() {
    const self = this;
    const cv = this.el.canvas;
    cv.addEventListener('mousemove', function (e) {
      self.mouseDir = { x: e.clientX - window.innerWidth / 2, y: e.clientY - window.innerHeight / 2, t: performance.now() };
    });
    cv.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      if (G.state === 'playing' && World.player && World.player.alive) {
        self.boostHeld = true;
        setBoost(World.player, true);
        self.btns.boost.root.classList.add('on');
      }
    });
    window.addEventListener('mouseup', function () {
      self.boostHeld = false;
      if (World.player) setBoost(World.player, false);
      self.btns.boost.root.classList.remove('on');
    });
  },

  /* ---------- 顶部按钮与浮层按钮 ---------- */
  bindButtons() {
    const self = this;
    this.el.btnSound.addEventListener('click', function () {
      SND.setMute(!G.muted);
      self.el.btnSound.classList.toggle('off', G.muted);
      if (!G.muted) SND.uiClick();
    });
    this.el.btnMusic.addEventListener('click', function () {
      SND.setMusic(!G.musicOn);
      self.el.btnMusic.classList.toggle('off', !G.musicOn);
      SND.uiClick();
    });
    this.el.btnPause.addEventListener('click', function () {
      SND.uiClick();
      if (G.state === 'playing') Game.pause();
    });
    document.getElementById('btnStart').addEventListener('click', function () {
      SND.init(); SND.resume(); SND.uiClick();
      const nm = (self.el.nameInput.value || '').trim() || '你';
      Game.start(nm);
    });
    document.getElementById('btnRespawn').addEventListener('click', function () {
      SND.uiClick();
      Game.respawn();
    });
    document.getElementById('btnResume').addEventListener('click', function () { SND.uiClick(); Game.resume(); });
    document.getElementById('btnRestart').addEventListener('click', function () { SND.uiClick(); Game.restart(); });
  },

  /* ---------- 输入汇总(每帧) ---------- */
  pollInput() {
    if (!World.player) return;
    // 优先级：触屏摇杆 > 键盘 > 鼠标
    if (this.joy.active) return; // 摇杆直接写 playerDir
    let kx = 0, ky = 0;
    const K = this.keys;
    if (K['arrowleft'] || K['a']) kx -= 1;
    if (K['arrowright'] || K['d']) kx += 1;
    if (K['arrowup'] || K['w']) ky -= 1;
    if (K['arrowdown'] || K['s']) ky += 1;
    if (kx || ky) { World.setPlayerDir(kx, ky); return; }
    if (this.mouseDir && performance.now() - this.mouseDir.t < 2000) {
      const m = Math.sqrt(this.mouseDir.x * this.mouseDir.x + this.mouseDir.y * this.mouseDir.y);
      if (m > 12) { World.setPlayerDir(this.mouseDir.x / m, this.mouseDir.y / m); return; }
    }
    World.setPlayerDir(0, 0);
  },

  /* ---------- HUD 刷新 ---------- */
  tick(dt) {
    this._hudTimer -= dt;
    this._lbTimer -= dt;
    const p = World.player;
    if (p) {
      if (this._hudTimer <= 0) {
        this._hudTimer = 0.1;
        this.el.score.textContent = fmtScore(p.score);
        this.el.headChip.textContent = p.value;
        this.el.lenChip.textContent = p.tail.length + 1;
        // 状态标签
        let chips = '';
        if (p.boosting) chips += '<span class="chip boost">加速中</span>';
        if (G.time < p.ghostUntil) chips += '<span class="chip ghost">隐身中</span>';
        if (G.time < p.dashUntil) chips += '<span class="chip dash">冲刺</span>';
        if (G.time < p.burningUntil) chips += '<span class="chip burn">烧伤</span>';
        this.el.statusChips.innerHTML = chips;
      }
      this.updateSkillButtons(p);
    }
    if (this._lbTimer <= 0) {
      this._lbTimer = 0.3;
      this.updateBoard();
    }
  },

  updateSkillButtons(p) {
    const now = G.time;
    // 加速
    const b = this.btns.boost;
    if (p.boosting) {
      const left = 1 - (p.boostEnd - now) / CFG.BOOST_DUR;
      b.cd.style.background = 'conic-gradient(rgba(255,212,59,0.45) ' + (left * 100) + '%, transparent 0)';
      b.root.classList.add('active');
    } else if (now < p.boostReadyAt) {
      const left = 1 - (p.boostReadyAt - now) / CFG.BOOST_CD;
      b.cd.style.background = 'conic-gradient(rgba(0,0,0,0.55) ' + (left * 100) + '%, transparent 0)';
      b.root.classList.remove('active');
    } else {
      b.cd.style.background = 'none';
      b.root.classList.remove('active');
    }
    // 其他技能
    const map = { dash: p.charges.dash, ghost: p.charges.ghost, burn: p.charges.burn };
    const cds = { dash: p.dashReadyAt, ghost: 0, burn: p.burnReadyAt };
    ['dash', 'ghost', 'burn'].forEach((k) => {
      const btn = this.btns[k];
      const n = map[k];
      let pips = '';
      for (let i = 0; i < CFG.MAX_CHARGES; i++) pips += '<i class="' + (i < n ? 'on' : '') + '"></i>';
      btn.pips.innerHTML = pips;
      const cdEnd = cds[k];
      if (n <= 0) {
        btn.root.classList.add('locked');
        btn.cd.style.background = 'rgba(20,30,50,0.45)';
      } else {
        btn.root.classList.remove('locked');
        if (cdEnd && now < cdEnd) {
          const left = 1 - (cdEnd - now) / (k === 'dash' ? CFG.DASH_CD : CFG.BURN_CD);
          btn.cd.style.background = 'conic-gradient(rgba(0,0,0,0.55) ' + (left * 100) + '%, transparent 0)';
        } else {
          btn.cd.style.background = 'none';
        }
      }
    });
  },

  updateBoard() {
    const rows = World.leaderboard;
    const p = World.player;
    let html = '';
    const medal = ['#ffd43b', '#ced4da', '#d08c60'];
    rows.forEach((c, i) => {
      const me = c === p;
      html += '<div class="br' + (me ? ' me' : '') + '">' +
        '<span class="rk" style="color:' + (i < 3 ? medal[i] : 'rgba(50,65,95,0.6)') + '">' + (i + 1) + '</span>' +
        '<span class="nm">' + escapeHtml(c.name) + '</span>' +
        '<span class="sc">' + fmtScore(c.score) + '</span></div>';
    });
    if (p && p.alive && rows.indexOf(p) < 0) {
      const rank = World.chains.filter(c => c.alive && c.score > p.score).length + 1;
      html += '<div class="br me"><span class="rk">' + rank + '</span><span class="nm">' + escapeHtml(p.name) + '</span><span class="sc">' + fmtScore(p.score) + '</span></div>';
    }
    this.el.board.innerHTML = html;
  },

  /* ---------- 提示 ---------- */
  toast(text, color) {
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = text;
    d.style.borderColor = color || 'rgba(66,85,122,0.4)';
    d.style.color = color || '#2b3a55';
    this.el.toastWrap.appendChild(d);
    while (this.el.toastWrap.children.length > 4) this.el.toastWrap.removeChild(this.el.toastWrap.firstChild);
    setTimeout(() => {
      d.classList.add('out');
      setTimeout(() => d.remove(), 400);
    }, 2200);
  },
  killfeed(text) {
    const d = document.createElement('div');
    d.className = 'kf';
    d.textContent = text;
    this.el.killfeed.appendChild(d);
    while (this.el.killfeed.children.length > 3) this.el.killfeed.removeChild(this.el.killfeed.firstChild);
    setTimeout(() => d.remove(), 3200);
  },

  /* ---------- 竖屏检测 ---------- */
  checkOrientation() {
    const portrait = window.innerHeight > window.innerWidth;
    this.el.portrait.style.display = portrait ? 'flex' : 'none';
    if (portrait && G.state === 'playing') Game.pause(true);
    if (!portrait && G.state === 'paused' && !Game.userPaused) Game.resume();
  },

  /* ---------- 浮层控制 ---------- */
  hideMenu() { this.el.menu.style.display = 'none'; },
  showMenu(best) {
    this.el.menu.style.display = 'flex';
    this.el.dead.style.display = 'none';
    this.el.pause.style.display = 'none';
    this.el.countdown.style.display = 'none';
    if (best > 0) this.el.menuBest.textContent = '历史最高：' + best;
  },
  showCountdown(n) {
    const c = this.el.countdown;
    c.style.display = 'flex';
    c.textContent = n;
    c.className = 'cdPop';
    void c.offsetWidth;
    c.className = 'cdPop go';
  },
  hideCountdown() { this.el.countdown.style.display = 'none'; },
  showDead(stats) {
    this.el.deadStats.innerHTML = stats;
    this.el.dead.style.display = 'flex';
  },
  hideDead() { this.el.dead.style.display = 'none'; },
  showPause() { this.el.pause.style.display = 'flex'; },
  hidePause() { this.el.pause.style.display = 'none'; },
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}
