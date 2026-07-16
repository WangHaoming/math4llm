// demos/least-squares/sketch.js
// 最小二乘法:拖动散点与直线,实时看残差平方和 SSE;
// 「一键拟合」对 (k, b) 做梯度下降动画,亲眼看 SSE 滚到谷底。

let viz;
const COL = {};
let ptNames = [];          // 散点手柄名列表
let nextId = 0;
let k = 0, b = 0;          // 当前直线参数(数学单位)
let fitting = false;       // 梯度下降动画进行中

// 初始散点:大致沿 y = 0.5x + 1 加噪声;初始直线故意放偏
const INIT_PTS = [[-6, -2], [-4.5, -1.5], [-3, 0], [-1.5, -0.5], [0, 1.5], [2, 1.5], [3.5, 3.5], [5, 3]];
const INIT_L1 = [-7, -5], INIT_L2 = [7, 2];
const MAX_PTS = 15;

// 画布尺寸 = 容器 #canvas-holder 的实际大小(随窗口伸缩)
function holderSize() {
  const el = document.getElementById('canvas-holder');
  return { w: Math.max(320, el.clientWidth), h: Math.max(320, el.clientHeight) };
}

function setup() {
  const { w, h } = holderSize();
  const c = createCanvas(w, h);
  c.parent('canvas-holder');

  COL.pt = color(255, 107, 107);      // 散点(红)
  COL.line = color(77, 171, 247);     // 当前直线(蓝)
  COL.best = color(81, 207, 102);     // 最佳拟合参考线(绿)
  COL.sq = color(255, 212, 59);       // 残差平方(黄)
  COL.white = color(255);

  resetData();

  // 画布跟随容器尺寸(原点保持居中)
  new ResizeObserver(() => {
    const s = holderSize();
    if (s.w !== width || s.h !== height) { resizeCanvas(s.w, s.h); viz.resize(s.w, s.h); }
  }).observe(document.getElementById('canvas-holder'));

  document.getElementById('btn-fit').addEventListener('click', () => { fitting = true; });
  document.getElementById('btn-reset').addEventListener('click', resetData);

  KatexSetup();
}

// 重建 MathViz 与所有端点,恢复初始散点和直线
function resetData() {
  fitting = false;
  viz = MathViz({ w: width, h: height, unit: 40 });
  ptNames = []; nextId = 0;
  for (const [x, y] of INIT_PTS) addPoint(x, y);
  viz.addHandle('L1', INIT_L1[0], INIT_L1[1], COL.line);
  viz.addHandle('L2', INIT_L2[0], INIT_L2[1], COL.line);
  deriveLineFromHandles();
}

function addPoint(x, y) {
  const name = 'p' + (nextId++);
  viz.addHandle(name, x, y, COL.pt);
  ptNames.push(name);
}

function draw() {
  background(15, 17, 23);
  viz.drawGrid();
  viz.drawTicks();

  const pts = ptNames.map(n => viz.units(n));
  const best = bestFit(pts);

  if (fitting) {
    gdStep(pts);                       // 每帧一步梯度下降
    syncLineHandles();
    if (best && Math.abs(k - best.k) < 1e-4 && Math.abs(b - best.b) < 1e-4) fitting = false;
    if (!best) fitting = false;
  } else {
    deriveLineFromHandles();
  }

  if (checked('showBest') && best) drawFullLine(best.k, best.b, COL.best, true);
  drawFullLine(k, b, COL.line, false);

  if (checked('showSquares')) for (const p of pts) drawSquare(p);
  if (checked('showResid')) for (const p of pts) drawResid(p);

  viz.drawHandles();
  updatePanel(pts, best);
}

// 由 L1/L2 两个端点派生 k、b(两点几乎垂直对齐时保持原值,避免斜率爆炸)
function deriveLineFromHandles() {
  const p1 = viz.units('L1'), p2 = viz.units('L2');
  if (Math.abs(p2.x - p1.x) < 0.2) return;
  k = (p2.y - p1.y) / (p2.x - p1.x);
  b = p1.y - k * p1.x;
}

// 拟合动画期间让 L1/L2 贴在当前直线上(保持各自 x 不变)
function syncLineHandles() {
  for (const name of ['L1', 'L2']) {
    const pos = viz.handle(name);
    pos.y = (k * (pos.x / viz.unit) + b) * viz.unit;
  }
}

// 闭式解:k* = Σ(x-x̄)(y-ȳ) / Σ(x-x̄)²,b* = ȳ − k*·x̄;x 全相同时无解
function bestFit(pts) {
  const n = pts.length;
  if (n < 2) return null;
  let mx = 0, my = 0;
  for (const p of pts) { mx += p.x; my += p.y; }
  mx /= n; my /= n;
  let sxx = 0, sxy = 0;
  for (const p of pts) { sxx += (p.x - mx) * (p.x - mx); sxy += (p.x - mx) * (p.y - my); }
  if (sxx < 1e-9) return null;
  const kb = sxy / sxx, bb = my - kb * mx;
  return { k: kb, b: bb, sse: sse(pts, kb, bb) };
}

function sse(pts, k_, b_) {
  let s = 0;
  for (const p of pts) { const e = p.y - (k_ * p.x + b_); s += e * e; }
  return s;
}

// 梯度下降一步。用"过均值点"的参数化 yhat = k·(x−x̄) + c(c 与 k 解耦,
// 下山不绕弯),步长按曲率归一,每步把与谷底的距离缩到约 90%
function gdStep(pts) {
  const n = pts.length;
  if (n < 2) { fitting = false; return; }
  let mx = 0, my = 0;
  for (const p of pts) { mx += p.x; my += p.y; }
  mx /= n; my /= n;
  let vxx = 0;
  for (const p of pts) vxx += (p.x - mx) * (p.x - mx);
  vxx /= n;
  if (vxx < 1e-9) { fitting = false; return; }

  let c = k * mx + b;
  let dk = 0, dc = 0;
  for (const p of pts) {
    const e = p.y - (k * (p.x - mx) + c);
    dk += -2 * e * (p.x - mx) / n;
    dc += -2 * e / n;
  }
  k -= (0.05 / vxx) * dk;
  c -= 0.05 * dc;
  b = c - k * mx;
}

// 画一条横贯画布的直线(数学单位下的 y = k·x + b)
function drawFullLine(k_, b_, col, dashed) {
  const x1 = -width / 2, x2 = width / 2;                      // 数学像素
  const y1 = k_ * x1 + b_ * viz.unit, y2 = k_ * x2 + b_ * viz.unit;
  const from = createVector(x1, y1), to = createVector(x2, y2);
  if (dashed) { viz.dashedLine(from, to, col, 160); return; }
  const s = viz.toScreen(from), e = viz.toScreen(to);
  push(); stroke(col); strokeWeight(2.5); line(s.x, s.y, e.x, e.y); pop();
}

// 残差:点到直线的竖直虚线
function drawResid(p) {
  const yhat = k * p.x + b;
  viz.dashedLine(viz.fromUnits(p.x, p.y), viz.fromUnits(p.x, yhat), COL.white, 110);
}

// 残差的平方:以残差为边长的正方形(向右侧展开),面积 = 该点对 SSE 的贡献
function drawSquare(p) {
  const yhat = k * p.x + b;
  const r = Math.abs(p.y - yhat);
  if (r < 1e-6) return;
  const top = Math.max(p.y, yhat);
  const s = viz.toScreen(viz.fromUnits(p.x, top));
  const side = r * viz.unit;
  push();
  fill(255, 212, 59, 40); stroke(255, 212, 59, 120); strokeWeight(1);
  rect(s.x, s.y, side, side);
  pop();
}

function updatePanel(pts, best) {
  set('k', k.toFixed(2));
  set('vb', b.toFixed(2));
  set('sse', sse(pts, k, b).toFixed(2));
  set('kbest', best ? best.k.toFixed(2) : '—');
  set('bbest', best ? best.b.toFixed(2) : '—');
  set('ssebest', best ? best.sse.toFixed(2) : '—');
}

// ---- 小工具 ----
const set = (id, txt) => { document.getElementById(id).textContent = txt; };
const checked = id => document.getElementById(id).checked;

// ---- 交互:拖拽 / 点空白加点 / 双击删点 ----
function mousePressed() {
  viz.onPressed();
  if (viz.isDragging()) { fitting = false; return; }   // 用户接管,停掉动画
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
  if (ptNames.length >= MAX_PTS) return;
  const u = viz.toUnits(viz.toLocal(mouseX, mouseY));
  addPoint(Math.round(u.x * 2) / 2, Math.round(u.y * 2) / 2);   // 吸附到 0.5
  fitting = false;
}
function mouseDragged() { viz.onDragged(); }
function mouseReleased() { viz.onReleased(); }

function doubleClicked() {
  if (ptNames.length <= 2) return;                     // 至少留两个点
  const m = createVector(mouseX, mouseY);
  for (let i = 0; i < ptNames.length; i++) {
    const s = viz.toScreen(viz.handle(ptNames[i]));
    if (p5.Vector.dist(m, s) < 16) {
      viz.removeHandle(ptNames[i]);
      ptNames.splice(i, 1);
      return;
    }
  }
}
