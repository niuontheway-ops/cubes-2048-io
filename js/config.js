'use strict';
/* ============================================================
 * CUBES 2048.io 复刻版 - 全局配置与工具
 * 原版玩法：立方体蛇 + 2048 合并 + 吞人 + 加速(2s/6sCD) + ÷减半陷阱
 * 改造：手机横屏 / 右手摇杆方向 / 左手技能 / 技能块系统
 * ============================================================ */

const G = {
  ver: '1.0.0',
  state: 'menu',        // menu | countdown | playing | dead | paused
  time: 0,              // 游戏内累计时间(秒)
  shake: 0,             // 屏幕震动强度
  best: 0,              // 历史最高分
  bestHead: 0,          // 历史最大头部数字
  muted: false,
  musicOn: true,
  win2048: false,       // 本局是否达成 2048
};

const CFG = {
  WORLD: 6400,          // 竞技场边长
  FOOD_COUNT: 520,      // 场上数字块数量
  SKILL_COUNT: 5,       // 场上技能块数量
  DIV_COUNT: 9,         // ÷ 陷阱数量
  ORB_COUNT: 4,         // 加速球数量
  BOT_COUNT: 18,        // AI 敌人数量
  MAX_CHAIN: 60,        // 单条链最大方块数
  BASE_SPEED: 268,      // 基础速度(单位/秒)
  TURN_RATE: 4.8,       // 玩家转向速率(弧度/秒)
  BOT_TURN: 3.4,
  BOOST_DUR: 2.0,       // 加速持续时间(与原版一致)
  BOOST_CD: 6.0,        // 加速冷却(与原版一致)
  BOOST_MUL: 1.9,
  DASH_DUR: 0.28,
  DASH_MUL: 3.1,
  DASH_CD: 1.6,
  GHOST_DUR: 3.5,
  BURN_CD: 2.0,
  BURN_SPEED: 780,
  BURN_LIFE: 1.4,
  MAX_CHARGES: 3,       // 技能块提供次数上限
  WIN_HEAD: 2048,
};

// 数字块权重(2 最多，大数字稀有)
const FOOD_VALUES = [2,2,2,2,2,2,2,2,2,4,4,4,4,4,8,8,8,8,16,16,32];

// 2048 经典色阶(亮色/暗色)
const TIER = {
  2:    ['#ff8787', '#c92a2a'],
  4:    ['#ffa94d', '#d9480f'],
  8:    ['#ffd43b', '#e67700'],
  16:   ['#a9e34b', '#5c940d'],
  32:   ['#51cf66', '#2b8a3e'],
  64:   ['#3bc9db', '#0b7285'],
  128:  ['#4dabf7', '#1864ab'],
  256:  ['#9775fa', '#5f3dc4'],
  512:  ['#f783ac', '#a61e4d'],
  1024: ['#ffe066', '#b8860b'],
  2048: ['#63e6be', '#0ca678'],
};
function tierColors(v) {
  if (TIER[v]) return TIER[v];
  const hue = (Math.log2(v) * 47) % 360;
  return ['hsl(' + hue + ',85%,66%)', 'hsl(' + hue + ',85%,44%)'];
}

// 技能定义
const SKILL_DEFS = {
  dash:  { name: '闪身步', icon: 'chevron', color: '#4dabf7', desc: '瞬间向前冲刺，迅速躲避迎面而来的敌人' },
  ghost: { name: '隐身',   icon: 'eye',     color: '#9775fa', desc: '短暂消失，期间无法攻击敌人' },
  burn:  { name: '烧心',   icon: 'flame',   color: '#ff6b6b', desc: '抛出烧心，被击中的敌人分数减半' },
};

const BOT_NAMES = [
  '小方块', '摸鱼达人', '合并狂魔', '蛇形走位', '干饭王', '方块守护者',
  '夜猫子', '闪电侠', '小熊猫', '奶茶三分糖', '熬夜冠军', '躺平选手',
  '内卷之王', '佛系玩家', '追风少年', '老六', '缝合怪', '无情铁手',
  '风一样', '数据删除', '头号玩家', '键盘侠', '躺赢专家', '菠萝头',
];

/* ---------------- 工具函数 ---------------- */
const TAU = Math.PI * 2;
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function angLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + d * t;
}
function fmtScore(n) {
  if (n >= 100000) return (n / 1000).toFixed(0) + 'k';
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}
function blockSize(v) { return 24 + 2.4 * Math.log2(Math.max(2, v)); }
function tier(v) { return Math.log2(Math.max(2, v)); }
