'use strict';
/* ============================================================
 * 渲染 - Canvas 2D( arena / 方块 / 技能块 / 敌人 / 粒子 / 小地图 )
 * ============================================================ */
const Render = {
  cv: null, ctx: null, W: 0, H: 0, dpr: 1,
  cam: { x: 0, y: 0, zoom: 1 },

  init(cv) {
    this.cv = cv;
    this.ctx = cv.getContext('2d');
    this.resize();
  },
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.cv.width = Math.floor(w * dpr);
    this.cv.height = Math.floor(h * dpr);
    this.cv.style.width = w + 'px';
    this.cv.style.height = h + 'px';
    this.dpr = dpr; this.W = w; this.H = h;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },

  frame(dt) {
    const ctx = this.ctx, W = this.W, H = this.H;
    const player = World.player;
    const now = G.time;

    // ---- 相机 ----
    if (G.state === 'menu') {
      // 菜单：相机在世界中缓慢漂移
      const t = G.wallT || 0;
      this.cam.x = lerp(this.cam.x, CFG.WORLD / 2 + Math.cos(t * 0.07) * 1100, 0.02);
      this.cam.y = lerp(this.cam.y, CFG.WORLD / 2 + Math.sin(t * 0.05) * 1100, 0.02);
      this.cam.zoom = lerp(this.cam.zoom, 0.55, 0.02);
    } else if (player) {
      const la = 70;
      const tx = player.hx + Math.cos(player.angle) * la;
      const ty = player.hy + Math.sin(player.angle) * la;
      const k = player.alive ? 1 - Math.exp(-dt * 6) : 1;
      this.cam.x = lerp(this.cam.x, tx, k);
      this.cam.y = lerp(this.cam.y, ty, k);
      const len = player.tail.length;
      const tz = clamp(Math.min(W / (1000 + len * 22), H / (560 + len * 13)), 0.32, 1.15);
      this.cam.zoom = lerp(this.cam.zoom, tz, 1 - Math.exp(-dt * 3));
    }

    // ---- 背景 ----
    ctx.fillStyle = '#eef2f7';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    const sh = G.shake;
    if (sh > 0.5) ctx.translate(rand(-sh, sh), rand(-sh, sh));
    const z = this.cam.zoom;
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-this.cam.x, -this.cam.y);

    const vw = W / z, vh = H / z;
    const x0 = this.cam.x - vw / 2 - 120, x1 = this.cam.x + vw / 2 + 120;
    const y0 = this.cam.y - vh / 2 - 120, y1 = this.cam.y + vh / 2 + 120;
    const vis = (x, y, r) => x > x0 - r && x < x1 + r && y > y0 - r && y < y1 + r;

    // 网格
    ctx.strokeStyle = 'rgba(110,130,165,0.13)';
    ctx.lineWidth = 1 / z;
    const gs = 160;
    ctx.beginPath();
    for (let gx = Math.floor(x0 / gs) * gs; gx < x1; gx += gs) { ctx.moveTo(gx, y0); ctx.lineTo(gx, y1); }
    for (let gy = Math.floor(y0 / gs) * gs; gy < y1; gy += gs) { ctx.moveTo(x0, gy); ctx.lineTo(x1, gy); }
    ctx.stroke();

    // 世界边界
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#42557a';
    ctx.strokeRect(0, 0, CFG.WORLD, CFG.WORLD);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(6, 6, CFG.WORLD - 12, CFG.WORLD - 12);

    // ÷ 陷阱
    for (const dv of World.divs) {
      if (!vis(dv.x, dv.y, 60)) continue;
      const pulse = 1 + Math.sin(now * 4 + dv.x) * 0.08;
      ctx.save();
      ctx.translate(dv.x, dv.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(255,80,80,0.16)';
      ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.fill();
      const g = ctx.createRadialGradient(0, -8, 4, 0, 0, 30);
      g.addColorStop(0, '#ff8787'); g.addColorStop(1, '#c92a2a');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 30px "Arial Rounded MT Bold","PingFang SC",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('÷', 0, 2);
      ctx.restore();
    }

    // 加速球
    for (const o of World.orbs) {
      if (!vis(o.x, o.y, 50)) continue;
      const p = 1 + Math.sin(now * 5 + o.bob) * 0.1;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.scale(p, p);
      ctx.fillStyle = 'rgba(255,212,59,0.25)';
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill();
      const g = ctx.createRadialGradient(0, -6, 3, 0, 0, 20);
      g.addColorStop(0, '#ffe066'); g.addColorStop(1, '#f08c00');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 19, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 19, 0, TAU); ctx.stroke();
      // 闪电
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(-3, -11); ctx.lineTo(5, -2); ctx.lineTo(1, -1); ctx.lineTo(5, 10);
      ctx.lineTo(-5, 0); ctx.lineTo(-1, -2); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // 技能块
    for (const s of World.skillBlocks) {
      if (!vis(s.x, s.y, 70)) continue;
      const def = SKILL_DEFS[s.type];
      const bob = Math.sin(now * 3 + s.bob) * 5;
      ctx.save();
      ctx.translate(s.x, s.y + bob);
      // 光晕
      ctx.fillStyle = def.color + '33';
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -now * 20;
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      // 底板
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      roundRect(ctx, -22, -22, 44, 44, 10); ctx.fill();
      ctx.strokeStyle = def.color; ctx.lineWidth = 2.5;
      roundRect(ctx, -22, -22, 44, 44, 10); ctx.stroke();
      drawIcon(ctx, def.icon, 0, 0, 20, def.color);
      // 名称
      ctx.font = 'bold 13px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,30,50,0.55)';
      ctx.strokeText(def.name, 0, 36);
      ctx.fillStyle = def.color;
      ctx.fillText(def.name, 0, 36);
      ctx.restore();
    }

    // 数字块
    for (const f of World.foods) {
      if (!vis(f.x, f.y, 30)) continue;
      const bob = Math.sin(now * 2.4 + f.bob) * 2;
      drawCube(ctx, f.x, f.y + bob, blockSize(f.value) * 0.78, f.value, 1, false);
    }

    // 链(敌人)
    for (const c of World.chains) {
      if (!c.alive || c === player) continue;
      if (!chainVisible(c, x0, x1, y0, y1)) continue;
      drawChain(ctx, c, now);
    }
    // 玩家
    if (player && player.alive) drawChain(ctx, player, now);

    // 子弹(烧心)
    for (const p of World.projectiles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillStyle = 'rgba(255,107,107,0.30)';
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill();
      // 心形
      ctx.scale(1.1, 1.1);
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.moveTo(0, 7);
      ctx.bezierCurveTo(-11, -2, -7, -11, 0, -5);
      ctx.bezierCurveTo(7, -11, 11, -2, 0, 7);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd43b';
      ctx.beginPath(); ctx.arc(-3, -3, 2.2, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // 粒子
    for (const p of World.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // 漂浮文字
    for (const t of World.texts) {
      ctx.globalAlpha = clamp(t.life, 0, 1);
      ctx.font = 'bold ' + t.size + 'px "Arial Rounded MT Bold","PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,30,50,0.5)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // 小地图
    this.minimap(ctx);
  },

  minimap(ctx) {
    const player = World.player;
    const S = Math.min(130, this.W * 0.2);
    const pad = 10;
    const mx = this.W - S - pad, my = pad + 118;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    roundRect(ctx, mx, my, S, S, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(66,85,122,0.5)'; ctx.lineWidth = 1.5;
    roundRect(ctx, mx, my, S, S, 8); ctx.stroke();
    const sc = S / CFG.WORLD;
    // ÷ 陷阱
    ctx.fillStyle = '#e03131';
    for (const dv of World.divs) ctx.fillRect(mx + dv.x * sc - 1.5, my + dv.y * sc - 1.5, 3, 3);
    // 技能块
    for (const s of World.skillBlocks) {
      ctx.fillStyle = SKILL_DEFS[s.type].color;
      ctx.beginPath(); ctx.arc(mx + s.x * sc, my + s.y * sc, 2.6, 0, TAU); ctx.fill();
    }
    // 链
    for (const c of World.chains) {
      if (!c.alive) continue;
      if (c === player) {
        ctx.fillStyle = '#1e90ff';
        ctx.beginPath(); ctx.arc(mx + c.hx * sc, my + c.hy * sc, 3.4, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(mx + c.hx * sc, my + c.hy * sc, 3.4, 0, TAU); ctx.stroke();
      } else {
        ctx.fillStyle = c.value > player.value ? '#e03131' : 'rgba(70,90,130,0.75)';
        ctx.fillRect(mx + c.hx * sc - 1.6, my + c.hy * sc - 1.6, 3.2, 3.2);
      }
    }
    ctx.restore();
  },
};

/* ---------- 基础绘制助手 ---------- */
function chainVisible(c, x0, x1, y0, y1) {
  const m = 120;
  if (c.hx > x0 - m && c.hx < x1 + m && c.hy > y0 - m && c.hy < y1 + m) return true;
  for (const b of c.tail) {
    if (b.x > x0 - m && b.x < x1 + m && b.y > y0 - m && b.y < y1 + m) return true;
  }
  return false;
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCube(ctx, x, y, size, value, alpha, glow) {
  const cols = tierColors(value);
  const s = size;
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  // 投影
  ctx.fillStyle = 'rgba(25,35,60,0.16)';
  roundRect(ctx, x - s / 2 + 2, y - s / 2 + 3, s, s, s * 0.22); ctx.fill();
  // 主体
  const g = ctx.createLinearGradient(x, y - s / 2, x, y + s / 2);
  g.addColorStop(0, cols[0]);
  g.addColorStop(1, cols[1]);
  if (glow) { ctx.shadowColor = cols[0]; ctx.shadowBlur = 16; }
  ctx.fillStyle = g;
  roundRect(ctx, x - s / 2, y - s / 2, s, s, s * 0.22); ctx.fill();
  ctx.shadowBlur = 0;
  // 顶部高光
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  roundRect(ctx, x - s / 2 + s * 0.13, y - s / 2 + s * 0.10, s * 0.74, s * 0.26, s * 0.11); ctx.fill();
  // 描边
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(1, s * 0.045);
  roundRect(ctx, x - s / 2, y - s / 2, s, s, s * 0.22); ctx.stroke();
  // 数字
  const digits = String(value).length;
  const fs = s * (digits <= 2 ? 0.44 : digits === 3 ? 0.36 : digits === 4 ? 0.29 : 0.23);
  ctx.font = 'bold ' + fs.toFixed(1) + 'px "Arial Rounded MT Bold","PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(1.5, fs * 0.16);
  ctx.strokeStyle = 'rgba(25,35,60,0.45)';
  ctx.strokeText(String(value), x, y + fs * 0.06);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(value), x, y + fs * 0.06);
  ctx.restore();
}

function drawIcon(ctx, type, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.22;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (type === 'chevron') {
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, -s * 0.55); ctx.lineTo(s * 0.05, 0); ctx.lineTo(-s * 0.5, s * 0.55);
    ctx.moveTo(s * 0.02, -s * 0.55); ctx.lineTo(s * 0.57, 0); ctx.lineTo(s * 0.02, s * 0.55);
    ctx.stroke();
  } else if (type === 'eye') {
    ctx.beginPath();
    ctx.moveTo(-s * 0.75, 0);
    ctx.quadraticCurveTo(0, -s * 0.6, s * 0.75, 0);
    ctx.quadraticCurveTo(0, s * 0.6, -s * 0.75, 0);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s * 0.26, 0, TAU); ctx.fill();
  } else if (type === 'flame') {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.7);
    ctx.quadraticCurveTo(s * 0.55, -s * 0.15, s * 0.38, s * 0.35);
    ctx.quadraticCurveTo(s * 0.28, s * 0.72, 0, s * 0.72);
    ctx.quadraticCurveTo(-s * 0.28, s * 0.72, -s * 0.38, s * 0.35);
    ctx.quadraticCurveTo(-s * 0.55, -s * 0.15, 0, -s * 0.7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.1);
    ctx.quadraticCurveTo(s * 0.2, s * 0.2, s * 0.1, s * 0.42);
    ctx.quadraticCurveTo(0, s * 0.6, -s * 0.1, s * 0.42);
    ctx.quadraticCurveTo(-s * 0.2, s * 0.2, 0, -s * 0.1);
    ctx.fill();
  }
  ctx.restore();
}

function drawChain(ctx, c, now) {
  const isPlayer = c === World.player;
  const ghost = now < c.ghostUntil;
  const alpha = ghost ? 0.20 : 1;
  const hs = blockSize(c.value);

  // 冲刺残影
  for (const t of c.trail) {
    const a = (1 - (now - t.t) / 0.28) * 0.30;
    if (a > 0) drawCube(ctx, t.x, t.y, hs * 0.95, c.value, a, false);
  }
  // 尾巴
  for (const b of c.tail) {
    drawCube(ctx, b.x, b.y, blockSize(b.value) * 0.82, b.value, alpha, false);
  }
  // 头
  drawCube(ctx, c.hx, c.hy, hs * 1.12, c.value, alpha, c.value >= 256);

  // 玩家光环
  if (isPlayer && !ghost) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(30,144,255,0.8)';
    ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(c.hx, c.hy, hs * 0.72, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // 隐身轮廓
  if (ghost) {
    ctx.save();
    ctx.strokeStyle = 'rgba(151,117,250,0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(c.hx, c.hy, hs * 0.75, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // 加速特效
  if (c.boosting) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,212,59,0.85)';
    ctx.lineWidth = 2.5;
    const a0 = c.angle + Math.PI;
    for (let i = -1; i <= 1; i++) {
      const a = a0 + i * 0.5;
      ctx.beginPath();
      ctx.moveTo(c.hx + Math.cos(a) * hs * 0.7, c.hy + Math.sin(a) * hs * 0.7);
      ctx.lineTo(c.hx + Math.cos(a) * (hs * 0.7 + 16), c.hy + Math.sin(a) * (hs * 0.7 + 16));
      ctx.stroke();
    }
    ctx.restore();
  }
  // 名字标签
  if (!ghost) {
    ctx.save();
    ctx.font = 'bold 13px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = isPlayer ? (c.name + ' ' + fmtScore(c.score)) : c.name;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(20,30,50,0.55)';
    ctx.strokeText(label, c.hx, c.hy - hs * 0.85);
    ctx.fillStyle = isPlayer ? '#1e90ff' : 'rgba(50,65,95,0.95)';
    ctx.fillText(label, c.hx, c.hy - hs * 0.85);
    ctx.restore();
  }
}
