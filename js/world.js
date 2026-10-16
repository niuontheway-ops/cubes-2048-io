'use strict';
/* ============================================================
 * 世界模拟 - 实体/移动/合并/吞人/技能/子弹/粒子
 * ============================================================ */
const World = {
  chains: [], foods: [], skillBlocks: [], divs: [], orbs: [],
  projectiles: [], particles: [], texts: [],
  player: null,
  _id: 0,
  _skillTimer: 0, _orbTimer: 0,
  leaderboard: [],
  hooks: {
    toast: function () {}, killfeed: function () {},
    onDeath: function () {}, onWin: function () {},
  },
};

/* ---------- 实体工厂 ---------- */
function makeChain(x, y, value, name, isBot) {
  return {
    id: ++World._id, name: name, isBot: !!isBot,
    hx: x, hy: y, angle: rand(0, TAU), value: value,
    tail: [],
    score: value, alive: true,
    inputDir: null,
    boosting: false, boostEnd: 0, boostReadyAt: 0, boostTick: 0,
    charges: { dash: 0, ghost: 0, burn: 0 },
    dashUntil: 0, dashReadyAt: 0,
    ghostUntil: 0, burnReadyAt: 0, burningUntil: 0, immuneUntil: 0,
    divCd: 0, trail: [],
    eatenPlayers: 0, eatenBlocks: 0, maxValue: value,
    ai: null, respawnAt: 0,
  };
}
function headR(c) { return blockSize(c.value) * 0.62; }
function blockR(v) { return blockSize(v) * 0.42; }

/* ---------- 世界初始化 ---------- */
World.reset = function (playerName) {
  World.chains.length = 0; World.foods.length = 0;
  World.skillBlocks.length = 0; World.divs.length = 0; World.orbs.length = 0;
  World.projectiles.length = 0; World.particles.length = 0; World.texts.length = 0;
  G.time = 0; G.shake = 0; G.win2048 = false;

  // 玩家出生在中心附近
  World.player = makeChain(CFG.WORLD / 2 + rand(-200, 200), CFG.WORLD / 2 + rand(-200, 200), 2, playerName || '你', false);
  World.player.tail = [
    { value: 2, x: World.player.hx - 30, y: World.player.hy },
    { value: 2, x: World.player.hx - 60, y: World.player.hy },
    { value: 4, x: World.player.hx - 90, y: World.player.hy },
  ];
  World.chains.push(World.player);

  // AI 敌人
  const names = BOT_NAMES.slice();
  for (let i = 0; i < CFG.BOT_COUNT; i++) {
    const nm = names.length ? names.splice(randInt(0, names.length - 1), 1)[0] : ('Bot' + i);
    const b = spawnBot(nm);
    World.chains.push(b);
  }
  for (let i = 0; i < CFG.FOOD_COUNT; i++) World.foods.push(spawnFood());
  for (let i = 0; i < CFG.SKILL_COUNT; i++) World.skillBlocks.push(spawnSkillBlock());
  for (let i = 0; i < CFG.DIV_COUNT; i++) World.divs.push(spawnDiv());
  for (let i = 0; i < CFG.ORB_COUNT; i++) World.orbs.push(spawnOrb());
  World._skillTimer = 0; World._orbTimer = 0;
  updateLeaderboard();
};

function spawnBot(name) {
  let x, y, tries = 0;
  do {
    x = rand(300, CFG.WORLD - 300); y = rand(300, CFG.WORLD - 300); tries++;
  } while (tries < 20 && World.player && dist(x, y, World.player.hx, World.player.hy) < 900);
  const b = makeChain(x, y, 2, name, true);
  const n = randInt(2, 4);
  for (let i = 0; i < n; i++) b.tail.push({ value: pick([2, 2, 4]), x: x - 30 * (i + 1), y: y });
  b.score = b.value + b.tail.reduce((s, k) => s + k.value, 0);
  b.ai = { t: 0, mode: 'food', tx: x, ty: y, deadAt: 0 };
  return b;
}

function spawnFood(x, y, v) {
  return { x: x !== undefined ? x : rand(60, CFG.WORLD - 60), y: y !== undefined ? y : rand(60, CFG.WORLD - 60), value: v || pick(FOOD_VALUES), bob: rand(0, TAU) };
}
function spawnSkillBlock() {
  const types = ['dash', 'ghost', 'burn'];
  return { x: rand(300, CFG.WORLD - 300), y: rand(300, CFG.WORLD - 300), type: pick(types), bob: rand(0, TAU) };
}
function spawnDiv() {
  return { x: rand(400, CFG.WORLD - 400), y: rand(400, CFG.WORLD - 400), rot: rand(0, TAU) };
}
function spawnOrb() {
  return { x: rand(300, CFG.WORLD - 300), y: rand(300, CFG.WORLD - 300), bob: rand(0, TAU) };
}

/* ---------- 粒子 / 漂浮文字 ---------- */
function burst(x, y, color, n, sp, life) {
  for (let i = 0; i < n; i++) {
    if (World.particles.length > 420) break;
    const a = rand(0, TAU), s = rand(sp * 0.3, sp);
    World.particles.push({
      x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: life || rand(0.3, 0.6), maxLife: life || 0.6,
      size: rand(2.5, 5.5), color: color, grav: 0,
    });
  }
}
function fireBurst(x, y) {
  const cols = ['#ffd43b', '#ff922b', '#ff6b6b', '#e8590c'];
  for (let i = 0; i < 26; i++) {
    const a = rand(0, TAU), s = rand(60, 320);
    World.particles.push({
      x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rand(0.3, 0.7), maxLife: 0.7, size: rand(4, 9),
      color: pick(cols), grav: -60,
    });
  }
}
function confetti() {
  const cols = ['#ff6b6b', '#ffd43b', '#51cf66', '#4dabf7', '#9775fa', '#f783ac'];
  for (let i = 0; i < 90; i++) {
    const a = rand(-Math.PI, 0), s = rand(150, 520);
    World.particles.push({
      x: World.player.hx, y: World.player.hy,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rand(0.8, 1.6), maxLife: 1.6, size: rand(3, 7),
      color: pick(cols), grav: 420,
    });
  }
}
function addText(x, y, text, color, size) {
  if (World.texts.length > 30) World.texts.shift();
  World.texts.push({ x: x, y: y, text: text, color: color || '#fff', size: size || 18, life: 1.0 });
}

/* ---------- 音效就近触发 ---------- */
function near(c) {
  return World.player && World.player.alive && dist(c.hx, c.hy, World.player.hx, World.player.hy) < 950;
}

/* ---------- 合并 ---------- */
function onMerge(c, newValue, x, y) {
  const cols = tierColors(newValue);
  burst(x, y, cols[0], 14, 240, 0.5);
  addText(x, y - 20, String(newValue), cols[0], 16 + Math.min(14, tier(newValue) * 1.5));
  if (near(c)) SND.merge(newValue);
  if (c === World.player) {
    if (newValue >= CFG.WIN_HEAD && !G.win2048) {
      G.win2048 = true;
      SND.win(); confetti();
      World.hooks.onWin();
    } else if (newValue >= 128) {
      World.hooks.toast('合并出 ' + newValue + ' ！', cols[0]);
    }
  }
}

/* ---------- 分数减半(烧心命中 / ÷ 陷阱共用底层) ---------- */
function halveScore(c) {
  const target = Math.floor(c.score / 2);
  let need = c.score - target;
  while (need > 0 && c.tail.length) {
    const b = c.tail.pop();
    need -= b.value;
    burst(b.x, b.y, tierColors(b.value)[0], 4, 130, 0.4);
  }
  if (need > 0 && c.value > 2) c.value = Math.max(2, Math.floor(c.value / 2));
  c.score = c.value + c.tail.reduce((s, b) => s + b.value, 0);
  c.burningUntil = G.time + 1.3;
  burst(c.hx, c.hy, '#ff6b6b', 18, 260, 0.6);
  if (near(c)) SND.burnHit();
  if (c === World.player) G.shake = Math.max(G.shake, 10);
}

/* ---------- 吞掉整条链 ---------- */
function devour(winner, loser) {
  // 转移失败者方块(超出上限的变回场上数字块)
  for (const b of loser.tail) {
    if (winner.tail.length < CFG.MAX_CHAIN) winner.tail.push({ value: b.value, x: b.x, y: b.y });
    else World.foods.push(spawnFood(b.x, b.y, b.value));
  }
  winner.score += loser.score;
  winner.eatenPlayers++;
  burst(loser.hx, loser.hy, tierColors(loser.value)[1], 30, 380, 0.8);
  burst(loser.hx, loser.hy, '#ffffff', 16, 300, 0.7);
  loser.alive = false;
  if (near(loser) || winner === World.player) SND.devour();
  if (winner === World.player) {
    World.hooks.toast('你吞掉了 ' + loser.name + '  +' + fmtScore(loser.score), '#ffd43b');
    addText(loser.hx, loser.hy - 40, '+' + fmtScore(loser.score), '#ffd43b', 22);
    G.shake = Math.max(G.shake, 6);
  } else if (loser === World.player) {
    World.hooks.killfeed(winner.name + ' 吞掉了 你');
    World.hooks.onDeath();
  } else if (near(loser)) {
    World.hooks.killfeed(winner.name + ' 吞掉了 ' + loser.name);
  }
  if (loser.isBot) loser.ai.deadAt = G.time;
}

/* ---------- 技能 ---------- */
function tryDash(c) {
  if (c.charges.dash <= 0 || G.time < c.dashReadyAt) return false;
  c.charges.dash--;
  c.dashUntil = G.time + CFG.DASH_DUR;
  c.immuneUntil = G.time + 0.65;
  c.dashReadyAt = G.time + CFG.DASH_CD;
  if (c === World.player || near(c)) SND.dash();
  burst(c.hx, c.hy, '#4dabf7', 12, 200, 0.4);
  return true;
}
function tryGhost(c) {
  if (c.charges.ghost <= 0 || G.time < c.ghostUntil) return false;
  c.charges.ghost--;
  c.ghostUntil = G.time + CFG.GHOST_DUR;
  if (c === World.player || near(c)) SND.ghostOn();
  burst(c.hx, c.hy, '#9775fa', 14, 160, 0.5);
  if (c === World.player) World.hooks.toast('隐身启动，期间无法攻击', '#9775fa');
  return true;
}
function tryBurn(c) {
  if (c.charges.burn <= 0 || G.time < c.burnReadyAt) return false;
  c.charges.burn--;
  c.burnReadyAt = G.time + CFG.BURN_CD;
  const a = c.angle;
  World.projectiles.push({
    x: c.hx + Math.cos(a) * headR(c), y: c.hy + Math.sin(a) * headR(c),
    vx: Math.cos(a) * CFG.BURN_SPEED, vy: Math.sin(a) * CFG.BURN_SPEED,
    life: CFG.BURN_LIFE, owner: c, r: 15,
  });
  if (c === World.player || near(c)) SND.burnThrow();
  return true;
}
function setBoost(c, on) {
  if (on) {
    if (!c.boosting && G.time >= c.boostReadyAt) {
      c.boosting = true; c.boostEnd = G.time + CFG.BOOST_DUR; c.boostTick = 0.35;
      if (c === World.player) SND.boostStart();
    }
  } else if (c.boosting) {
    c.boosting = false;
    c.boostReadyAt = G.time + CFG.BOOST_CD;
    if (c === World.player) SND.boostStop();
  }
}
function endBoostIfDue(c) {
  if (c.boosting && G.time >= c.boostEnd) {
    c.boosting = false;
    c.boostReadyAt = G.time + CFG.BOOST_CD;
    if (c === World.player) SND.boostStop();
  }
}

/* ---------- 主更新 ---------- */
World.update = function (dt) {
  G.time += dt;
  const now = G.time;
  const player = World.player;

  // ---- 链更新 ----
  for (const c of World.chains) {
    if (!c.alive) {
      if (c.isBot && c.ai && c.ai.deadAt && now - c.ai.deadAt > 3) {
        // AI 复活
        const nb = spawnBot(c.name);
        nb.id = c.id;
        World.chains[World.chains.indexOf(c)] = nb;
      }
      continue;
    }
    // 菜单演示模式：玩家静止，不参与任何交互
    if (World.demoMode && c === World.player) continue;
    // 转向
    if (c.inputDir) {
      const ta = Math.atan2(c.inputDir.y, c.inputDir.x);
      const rate = c.isBot ? CFG.BOT_TURN : CFG.TURN_RATE;
      c.angle = angLerp(c.angle, ta, clamp(rate * dt, 0, 1));
    }
    let speed = CFG.BASE_SPEED * (1 - Math.min(0.32, c.tail.length * 0.0045));
    if (c.boosting) speed *= CFG.BOOST_MUL;
    if (now < c.dashUntil) speed *= CFG.DASH_MUL;
    c.hx += Math.cos(c.angle) * speed * dt;
    c.hy += Math.sin(c.angle) * speed * dt;
    // 边界反弹
    const r = headR(c);
    if (c.hx < r) { c.hx = r; c.angle = Math.PI - c.angle; }
    if (c.hx > CFG.WORLD - r) { c.hx = CFG.WORLD - r; c.angle = Math.PI - c.angle; }
    if (c.hy < r) { c.hy = r; c.angle = -c.angle; }
    if (c.hy > CFG.WORLD - r) { c.hy = CFG.WORLD - r; c.angle = -c.angle; }
    // 加速消耗尾部最小方块
    if (c.boosting) {
      c.boostTick -= dt;
      if (c.boostTick <= 0) {
        c.boostTick = 0.35;
        if (c.tail.length > 1) {
          let mi = 0;
          for (let i = 1; i < c.tail.length; i++) if (c.tail[i].value < c.tail[mi].value) mi = i;
          const b = c.tail.splice(mi, 1)[0];
          World.foods.push(spawnFood(b.x, b.y, b.value));
          c.score -= b.value;
          burst(b.x, b.y, tierColors(b.value)[0], 5, 90, 0.35);
        }
      }
    }
    endBoostIfDue(c);
    // 尾随
    let px = c.hx, py = c.hy;
    const sp = blockSize(c.value) * 1.04;
    for (let i = 0; i < c.tail.length; i++) {
      const b = c.tail[i];
      const dx = px - b.x, dy = py - b.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > sp) { const t = sp / d; b.x = px - dx * t; b.y = py - dy * t; }
      px = b.x; py = b.y;
    }
    // 冲刺拖尾
    if (now < c.dashUntil) {
      c.trail.push({ x: c.hx, y: c.hy, t: now });
    }
    while (c.trail.length && now - c.trail[0].t > 0.28) c.trail.shift();
    // 隐身粒子
    if (now < c.ghostUntil && Math.random() < dt * 20) {
      World.particles.push({
        x: c.hx + rand(-20, 20), y: c.hy + rand(-20, 20),
        vx: rand(-15, 15), vy: rand(-35, -12), life: 0.5, maxLife: 0.5,
        size: rand(2, 4), color: '#9775fa', grav: -30,
      });
    }
    // 焚烧粒子
    if (now < c.burningUntil && Math.random() < dt * 26) {
      const b = Math.random() < 0.5 ? { x: c.hx, y: c.hy } : (c.tail.length ? pick(c.tail) : null);
      if (b) World.particles.push({
        x: b.x + rand(-10, 10), y: b.y + rand(-10, 10),
        vx: rand(-20, 20), vy: rand(-60, -20), life: 0.45, maxLife: 0.45,
        size: rand(3, 6), color: pick(['#ffd43b', '#ff922b', '#ff6b6b']), grav: -80,
      });
    }
    // AI 决策
    if (c.isBot && c.ai) botThink(c, dt);
    // 吃数字块
    const hr = headR(c);
    for (let i = World.foods.length - 1; i >= 0; i--) {
      const f = World.foods[i];
      if (Math.abs(f.x - c.hx) > hr + 30 || Math.abs(f.y - c.hy) > hr + 30) continue;
      const d = dist(f.x, f.y, c.hx, c.hy);
      if (d < hr + blockR(f.value)) {
        if (f.value === c.value && c.value < 65536) {
          c.value *= 2;
          if (c.value > c.maxValue) c.maxValue = c.value;
          World.foods.splice(i, 1);
          World.foods.push(spawnFood());
          onMerge(c, c.value, c.hx, c.hy);
        } else if (f.value < c.value) {
          if (c.tail.length < CFG.MAX_CHAIN) c.tail.push({ value: f.value, x: f.x, y: f.y });
          else c.score += f.value;
          c.eatenBlocks++;
          World.foods.splice(i, 1);
          World.foods.push(spawnFood());
          if (c === World.player || near(c)) SND.eat(f.value);
        }
      }
    }
    // 吃技能块
    for (let i = World.skillBlocks.length - 1; i >= 0; i--) {
      const s = World.skillBlocks[i];
      if (dist(s.x, s.y, c.hx, c.hy) < hr + 26) {
        if (c.charges[s.type] < CFG.MAX_CHARGES) {
          c.charges[s.type]++;
          if (c === World.player) {
            SND.skillGet();
            World.hooks.toast('获得技能：' + SKILL_DEFS[s.type].name + ' ×1', SKILL_DEFS[s.type].color);
          } else if (near(c)) SND.skillGet();
        } else {
          c.score += 8;
        }
        burst(s.x, s.y, SKILL_DEFS[s.type].color, 12, 180, 0.5);
        World.skillBlocks.splice(i, 1);
        World._skillTimer = 6;
        break;
      }
    }
    // ÷ 陷阱
    if (now >= c.divCd) {
      for (const dv of World.divs) {
        if (dist(dv.x, dv.y, c.hx, c.hy) < hr + 30) {
          halveValues(c);
          c.divCd = now + 1.6;
          if (c === World.player) {
            World.hooks.toast('踩到 ÷ ！数字减半', '#ff6b6b');
            G.shake = Math.max(G.shake, 12);
          }
          break;
        }
      }
    }
    // 加速球
    for (let i = World.orbs.length - 1; i >= 0; i--) {
      const o = World.orbs[i];
      if (dist(o.x, o.y, c.hx, c.hy) < hr + 22) {
        if (G.time >= c.boostReadyAt && !c.boosting) {
          c.boostReadyAt = 0;
          if (c === World.player) { SND.orbGet(); World.hooks.toast('加速已就绪', '#ffd43b'); }
        } else {
          c.score += 16;
          if (c === World.player) addText(o.x, o.y - 20, '+16', '#ffd43b', 16);
        }
        burst(o.x, o.y, '#ffd43b', 10, 170, 0.4);
        World.orbs.splice(i, 1);
        World._orbTimer = 10;
        break;
      }
    }
    // 链内合并
    if (c.tail.length && c.tail[0].value === c.value && c.value < 65536) {
      c.value *= 2;
      if (c.value > c.maxValue) c.maxValue = c.value;
      c.tail.shift();
      onMerge(c, c.value, c.hx, c.hy);
    }
    for (let i = 0; i < c.tail.length - 1; i++) {
      if (c.tail[i].value === c.tail[i + 1].value && c.tail[i].value < 65536) {
        const nv = c.tail[i].value * 2;
        c.tail[i].value = nv;
        c.tail.splice(i + 1, 1);
        onMerge(c, nv, c.tail[i].x, c.tail[i].y);
        i--;
      }
    }
    c.score = c.value + c.tail.reduce((s, b) => s + b.value, 0);
  }

  // ---- 链间交互 ----
  const n = World.chains.length;
  for (let i = 0; i < n; i++) {
    const a = World.chains[i];
    if (!a.alive) continue;
    if (World.demoMode && a === World.player) continue;
    for (let j = i + 1; j < n; j++) {
      const b = World.chains[j];
      if (!b.alive) continue;
      if (World.demoMode && b === World.player) continue;
      // 隐身期间不参与玩家间交互
      if (now < a.ghostUntil || now < b.ghostUntil) continue;
      const ra = headR(a), rb = headR(b);
      const dd = dist(a.hx, a.hy, b.hx, b.hy);
      if (dd < ra + rb) {
        if (a.value > b.value && now >= b.immuneUntil) { devour(a, b); if (!a.alive) break; continue; }
        if (b.value > a.value && now >= a.immuneUntil) { devour(b, a); continue; }
      }
      headVsTail(a, b);
      headVsTail(b, a);
    }
  }

  // ---- 子弹 ----
  for (let i = World.projectiles.length - 1; i >= 0; i--) {
    const p = World.projectiles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.life -= dt;
    if (Math.random() < dt * 40) {
      World.particles.push({
        x: p.x, y: p.y, vx: rand(-25, 25), vy: rand(-40, -5),
        life: 0.35, maxLife: 0.35, size: rand(3, 6),
        color: pick(['#ffd43b', '#ff922b', '#ff6b6b']), grav: -40,
      });
    }
    let hit = false;
    if (p.life <= 0 || p.x < 0 || p.y < 0 || p.x > CFG.WORLD || p.y > CFG.WORLD) {
      if (p.life <= 0) burst(p.x, p.y, '#ff922b', 6, 90, 0.3);
      World.projectiles.splice(i, 1);
      continue;
    }
    for (const c of World.chains) {
      if (!c.alive || c === p.owner || now < c.ghostUntil) continue;
      if (World.demoMode && c === World.player) continue;
      let touched = dist(p.x, p.y, c.hx, c.hy) < p.r + headR(c);
      if (!touched) {
        for (const b of c.tail) {
          if (dist(p.x, p.y, b.x, b.y) < p.r + blockR(b.value)) { touched = true; break; }
        }
      }
      if (touched) {
        halveScore(c);
        fireBurst(p.x, p.y);
        if (p.owner === World.player) {
          World.hooks.toast('烧心命中 ' + c.name + '，分数减半！', '#ff6b6b');
          addText(c.hx, c.hy - 46, '分数减半', '#ff6b6b', 20);
        } else if (c === World.player) {
          World.hooks.killfeed(p.owner.name + ' 的烧心命中了你');
        }
        hit = true;
        break;
      }
    }
    if (hit) World.projectiles.splice(i, 1);
  }

  // ---- 粒子 / 文字 ----
  for (let i = World.particles.length - 1; i >= 0; i--) {
    const p = World.particles[i];
    p.life -= dt;
    if (p.life <= 0) { World.particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += (p.grav || 0) * dt;
    p.vx *= (1 - 1.8 * dt); p.vy *= (1 - 1.8 * dt);
  }
  for (let i = World.texts.length - 1; i >= 0; i--) {
    const t = World.texts[i];
    t.life -= dt; t.y -= 42 * dt;
    if (t.life <= 0) World.texts.splice(i, 1);
  }

  // ---- 补充资源 ----
  while (World.foods.length < CFG.FOOD_COUNT) World.foods.push(spawnFood());
  World._skillTimer -= dt;
  if (World.skillBlocks.length < CFG.SKILL_COUNT && World._skillTimer <= 0) {
    World.skillBlocks.push(spawnSkillBlock());
    World._skillTimer = 5;
  }
  World._orbTimer -= dt;
  if (World.orbs.length < CFG.ORB_COUNT && World._orbTimer <= 0) {
    World.orbs.push(spawnOrb());
    World._orbTimer = 9;
  }
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);

  updateLeaderboard();
};

function halveValues(c) {
  c.value = Math.max(2, Math.floor(c.value / 2));
  for (const b of c.tail) b.value = Math.max(2, Math.floor(b.value / 2));
  c.score = c.value + c.tail.reduce((s, b) => s + b.value, 0);
  burst(c.hx, c.hy, '#ff6b6b', 14, 200, 0.5);
  if (near(c)) SND.zap();
}

function headVsTail(a, b) {
  // a 的头 撞 b 的尾：a 头部数字更大则吞掉那块
  if (a.value <= 2) return;
  const ra = headR(a);
  for (let i = b.tail.length - 1; i >= 0; i--) {
    const blk = b.tail[i];
    if (a.value > blk.value && dist(a.hx, a.hy, blk.x, blk.y) < ra + blockR(blk.value)) {
      b.tail.splice(i, 1);
      b.score -= blk.value;
      if (a.tail.length < CFG.MAX_CHAIN) a.tail.push({ value: blk.value, x: blk.x, y: blk.y });
      else a.score += blk.value;
      a.eatenBlocks++;
      burst(blk.x, blk.y, tierColors(blk.value)[0], 6, 140, 0.35);
      if (a === World.player) addText(blk.x, blk.y - 16, '+' + blk.value, '#a9e34b', 15);
      else if (near(a)) SND.absorb();
      return;
    }
  }
}

function updateLeaderboard() {
  const arr = World.chains.filter(c => c.alive);
  arr.sort((x, y) => y.score - x.score);
  World.leaderboard = arr.slice(0, 10);
}

/* ---------- 玩家输入方向(由 UI 设置) ---------- */
World.setPlayerDir = function (x, y) {
  if (!World.player) return;
  const m = Math.sqrt(x * x + y * y);
  if (m < 0.18) World.player.inputDir = null;
  else World.player.inputDir = { x: x / m, y: y / m };
};
