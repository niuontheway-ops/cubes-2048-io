'use strict';
/* ============================================================
 * AI 敌人 - 觅食 / 追击 / 逃逸 / 捡技能块 / 用技能
 * ============================================================ */
function botThink(c, dt) {
  const ai = c.ai;
  ai.t -= dt;
  if (ai.t > 0) return;
  ai.t = rand(0.1, 0.18);

  const now = G.time;
  const myV = c.value;
  let threat = null, threatD = 1e9;
  let prey = null, preyD = 1e9;
  let food = null, foodD = 1e9, foodScore = -1;
  let skill = null, skillD = 1e9;
  let orb = null, orbD = 1e9;

  // 扫描其他链
  for (const o of World.chains) {
    if (o === c || !o.alive) continue;
    if (now < o.ghostUntil) continue; // 隐身者不可见
    const d = dist(c.hx, c.hy, o.hx, o.hy);
    if (o.value > myV && d < 820 && d < threatD) { threat = o; threatD = d; }
    if (o.value < myV && d < 980 && d < preyD) { prey = o; preyD = d; }
  }
  // 扫描食物(优先等值 > 较小 > 其他)
  for (const f of World.foods) {
    const d = dist(c.hx, c.hy, f.x, f.y);
    if (d > 1100) continue;
    let s = 0;
    if (f.value === myV) s = 3;
    else if (f.value < myV) s = 2;
    else s = 1;
    s -= d / 1100;
    if (s > foodScore) { foodScore = s; food = f; foodD = d; }
  }
  // 技能块
  for (const s of World.skillBlocks) {
    const d = dist(c.hx, c.hy, s.x, s.y);
    if (d < 760 && d < skillD) { skill = s; skillD = d; }
  }
  // 加速球
  for (const o of World.orbs) {
    const d = dist(c.hx, c.hy, o.x, o.y);
    if (d < 640 && d < orbD) { orb = o; orbD = d; }
  }

  // ---- 决策 ----
  let tx = c.hx, ty = c.hy;
  if (threat && threatD < 700) {
    // 逃逸
    const a = Math.atan2(c.hy - threat.hy, c.hx - threat.hx);
    tx = c.hx + Math.cos(a) * 500;
    ty = c.hy + Math.sin(a) * 500;
    // 技能：危急用隐身/闪身步/加速
    if (c.charges.ghost > 0 && threatD < 420 && Math.random() < 0.75) tryGhost(c);
    if (c.charges.dash > 0 && threatD < 540 && Math.random() < 0.55) tryDash(c);
    if (threatD < 460 && Math.random() < 0.4) setBoost(c, true);
  } else if (prey && preyD < 900) {
    // 追击
    tx = prey.hx; ty = prey.hy;
    const ang = Math.atan2(prey.hy - c.hy, prey.hx - c.hx);
    let diff = Math.abs(((ang - c.angle + Math.PI * 3) % TAU) - Math.PI);
    if (c.charges.burn > 0 && preyD < 540 && diff < 0.55 && Math.random() < 0.6) tryBurn(c);
    if (c.charges.dash > 0 && preyD < 400 && diff < 0.8 && Math.random() < 0.4) tryDash(c);
    if (preyD > 420 && Math.random() < 0.3) setBoost(c, true);
  } else if (skill && skillD < 720) {
    tx = skill.x; ty = skill.y;
  } else if (orb && orbD < 620 && G.time >= c.boostReadyAt) {
    tx = orb.x; ty = orb.y;
  } else if (food) {
    tx = food.x; ty = food.y;
    if (foodD > 500 && Math.random() < 0.25) setBoost(c, true);
  } else {
    // 漫游
    if (dist(c.hx, c.hy, ai.tx, ai.ty) < 200 || !isFinite(ai.tx)) {
      ai.tx = rand(300, CFG.WORLD - 300);
      ai.ty = rand(300, CFG.WORLD - 300);
    }
    tx = ai.tx; ty = ai.ty;
  }

  // ÷ 陷阱排斥
  for (const dv of World.divs) {
    const d = dist(c.hx, c.hy, dv.x, dv.y);
    if (d < 400) {
      const w = (400 - d) / 400 * 1.6;
      tx += (c.hx - dv.x) / Math.max(40, d) * 260 * w;
      ty += (c.hy - dv.y) / Math.max(40, d) * 260 * w;
    }
  }
  // 远离墙壁
  const m = 500;
  if (c.hx < m) tx += (m - c.hx) * 2.2;
  if (c.hx > CFG.WORLD - m) tx -= (m - (CFG.WORLD - c.hx)) * 2.2;
  if (c.hy < m) ty += (m - c.hy) * 2.2;
  if (c.hy > CFG.WORLD - m) ty -= (m - (CFG.WORLD - c.hy)) * 2.2;

  const dx = tx - c.hx, dy = ty - c.hy;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 8) {
    c.inputDir = { x: dx / len, y: dy / len };
  }
}
