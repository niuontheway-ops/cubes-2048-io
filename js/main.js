'use strict';
/* ============================================================
 * 主控 - 启动 / 状态机 / 主循环 / 全屏横屏
 * ============================================================ */
const Game = {
  cdT: 0, cdLast: 99,
  userPaused: false,

  boot() {
    Render.init(document.getElementById('game'));
    UI.init();
    // 读取历史最高
    try {
      G.best = parseInt(localStorage.getItem('cubes2048_best') || '0', 10) || 0;
      G.bestHead = parseInt(localStorage.getItem('cubes2048_besthead') || '0', 10) || 0;
    } catch (e) { G.best = 0; G.bestHead = 0; }

    // 世界钩子
    World.hooks.toast = function (t, c) { UI.toast(t, c); };
    World.hooks.killfeed = function (t) { UI.killfeed(t); };
    World.hooks.onWin = function () {
      UI.toast('达成 2048 ！继续膨胀', '#63e6be');
      UI.killfeed('你 达成了 2048 头部！');
    };
    World.hooks.onDeath = function () {
      if (G.state !== 'playing') return;
      G.state = 'dead';
      setBoost(World.player, false);
      UI.btns.boost.root.classList.remove('on');
      SND.death();
      G.shake = Math.max(G.shake, 14);
      const p = World.player;
      const rank = World.chains.filter(c => c.alive && c.score > p.score).length + 1;
      let bestBeat = false;
      if (p.score > G.best) { G.best = p.score; bestBeat = true; try { localStorage.setItem('cubes2048_best', String(G.best)); } catch (e) {} }
      if (p.maxValue > G.bestHead) { G.bestHead = p.maxValue; try { localStorage.setItem('cubes2048_besthead', String(G.bestHead)); } catch (e) {} }
      const stats =
        row('最终分数', fmtScore(p.score) + (bestBeat ? '  <b class="newbest">新纪录!</b>' : '')) +
        row('头部数字', String(p.maxValue)) +
        row('吞掉玩家', p.eatenPlayers + ' 人') +
        row('吞掉方块', p.eatenBlocks + ' 个') +
        row('存活时间', Math.floor(G.time / 60) + ' 分 ' + Math.floor(G.time % 60) + ' 秒') +
        row('最高排名', '第 ' + rank + ' 名');
      setTimeout(() => { if (G.state === 'dead') UI.showDead(stats); }, 1200);
    };

    // 菜单背景世界(演示模式：玩家静止，AI 自由活动)
    World.reset('你');
    World.demoMode = true;
    UI.showMenu(G.best);

    // 事件
    window.addEventListener('resize', () => Render.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && G.state === 'playing') Game.pause(false);
    });

    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  },

  loop(now) {
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    G.wallT = (G.wallT || 0) + dt;

    if (G.state === 'playing') {
      UI.pollInput();
      World.update(dt);
      UI.tick(dt);
    } else if (G.state === 'countdown') {
      this.cdT -= dt;
      const n = Math.ceil(this.cdT);
      if (n !== this.cdLast && n > 0) {
        this.cdLast = n;
        UI.showCountdown(n);
        SND.tick();
      }
      if (this.cdT <= 0) {
        UI.hideCountdown();
        UI.showCountdown('GO!');
        SND.go();
        setTimeout(() => UI.hideCountdown(), 650);
        G.state = 'playing';
      }
    } else if (G.state === 'menu') {
      // 演示模式：AI 活动，玩家静止
      World.update(dt);
    }
    Render.frame(dt);
    requestAnimationFrame((t) => this.loop(t));
  },

  start(name) {
    tryFullscreen();
    this.begin(name);
  },
  respawn() { this.begin(World.player ? World.player.name : '你'); },
  restart() { this.begin(World.player ? World.player.name : '你'); },

  begin(name) {
    UI.hideMenu();
    UI.hideDead();
    UI.hidePause();
    UI.hideCountdown();
    World.reset(name);
    World.demoMode = false;
    G.state = 'countdown';
    this.cdT = 3.0;
    this.cdLast = 99;
    this.userPaused = false;
    SND.resume();
    if (G.musicOn) { SND.init(); SND.startMusic(); }
  },

  pause(fromPortrait) {
    if (G.state !== 'playing') return;
    G.state = 'paused';
    this.userPaused = !fromPortrait;
    if (!fromPortrait) UI.showPause();
    if (World.player) setBoost(World.player, false);
    SND.boostStop();
  },
  resume() {
    if (G.state !== 'paused') return;
    UI.hidePause();
    G.state = 'playing';
    this.userPaused = false;
    SND.resume();
  },
};

function tryFullscreen() {
  try {
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {});
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  } catch (e) { /* ignore */ }
}

function row(k, v) {
  return '<div class="dsRow"><span>' + k + '</span><b>' + v + '</b></div>';
}

window.addEventListener('load', () => Game.boot());
