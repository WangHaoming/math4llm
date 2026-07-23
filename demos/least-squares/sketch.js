// demos/least-squares/sketch.js
// 最小二乘法:拖动散点与直线,实时看残差平方和 SSE 与残差绝对值和 SAE;
// 同屏对比两条最优线——绿色 L2(平方误差,闭式解)与紫色 L1(绝对值误差,
// 暴力精确解)。两个「迈一步」按钮用**试探法(爬山)**逐步拟合:每步把直线朝
// 四个方向各试探一点、保留误差最小的那个,卡住就把试探步长减半——只需会算
// 误差、会比大小,完全不碰导数(导数与梯度下降留到下一节)。

let viz;
const COL = {};
let ptNames = [];          // 散点手柄名列表
let nextId = 0;
let k = 0, b = 0;          // 当前直线参数(数学单位)

// 逐步拟合状态:当前用哪种方法、已走几步、最近一步的详细信息
let stepMethod = null;     // 'L2' | 'L1' | null
let stepCount = 0;         // 当前连续拟合累计步数
let stepInfo = null;       // 最近一步的详细数据(供面板显示)
let probeK = 0, probeB = 0;// 试探步长(斜率方向 / 截距方向),随卡壳逐步减半

const PROBE_K0 = 0.20;     // 斜率初始试探步长
const PROBE_B0 = 0.30;     // 截距初始试探步长
const PROBE_GROW = 1.3;    // 试探成功时把该方向步长放大(加速),否则原地减半
const CONV_TOL = 1e-3;     // 收敛判据:两个方向的试探步长都小于它,就算到了最优

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
  COL.best = color(81, 207, 102);     // L2 最小二乘参考线(绿)
  COL.bestL1 = color(177, 151, 252);  // L1 最小绝对偏差参考线(紫)
  COL.sq = color(255, 212, 59);       // 残差平方(黄)
  COL.white = color(255);

  resetData();

  // 画布跟随容器尺寸(原点保持居中)
  new ResizeObserver(() => {
    const s = holderSize();
    if (s.w !== width || s.h !== height) { resizeCanvas(s.w, s.h); viz.resize(s.w, s.h); }
  }).observe(document.getElementById('canvas-holder'));

  document.getElementById('btn-fit-l2').addEventListener('click', () => doStep('L2'));
  document.getElementById('btn-fit-l1').addEventListener('click', () => doStep('L1'));
  document.getElementById('btn-reset').addEventListener('click', resetData);

  KatexSetup();
}

// 重建 MathViz 与所有端点,恢复初始散点和直线
function resetData() {
  resetStep();
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
  const bestL1 = bestFitL1(pts);

  deriveLineFromHandles();             // 蓝线始终由两个端点决定;拟合一步后端点已同步

  if (checked('showBest') && best) drawFullLine(best.k, best.b, COL.best, true);
  if (checked('showBestL1') && bestL1) drawFullLine(bestL1.k, bestL1.b, COL.bestL1, true);
  drawFullLine(k, b, COL.line, false);

  if (checked('showSquares')) for (const p of pts) drawSquare(p);
  if (checked('showResid')) for (const p of pts) drawResid(p);

  viz.drawHandles();
  updatePanel(pts, best, bestL1);
}

// 由 L1/L2 两个端点派生 k、b(两点几乎垂直对齐时保持原值,避免斜率爆炸)
function deriveLineFromHandles() {
  const p1 = viz.units('L1'), p2 = viz.units('L2');
  if (Math.abs(p2.x - p1.x) < 0.2) return;
  k = (p2.y - p1.y) / (p2.x - p1.x);
  b = p1.y - k * p1.x;
}

// 拟合走完一步后,让 L1/L2 两个端点贴回新直线上(保持各自 x 不变)
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

// 残差绝对值和 SAE = Σ|yᵢ − (k·xᵢ + b)|(= 画布上所有残差竖线的总长度)
function sae(pts, k_, b_) {
  let s = 0;
  for (const p of pts) s += Math.abs(p.y - (k_ * p.x + b_));
  return s;
}

// 最小绝对偏差(LAD / L1)最优直线:目标 min Σ|eᵢ| 没有闭式解(本质是线性规划),
// 但有个漂亮性质——最优线一定恰好穿过其中至少两个数据点。于是枚举所有点对
// (n≤15,最多 105 对)确定候选 (k, b),取 SAE 最小者即精确解。x 相同的点对
// 对应竖线(斜率无穷),跳过。全部点 x 相同时无解,返回 null(面板显示"—")。
function bestFitL1(pts) {
  const n = pts.length;
  if (n < 2) return null;
  let best = null;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = pts[j].x - pts[i].x;
      if (Math.abs(dx) < 1e-9) continue;
      const kk = (pts[j].y - pts[i].y) / dx;
      const bb = pts[i].y - kk * pts[i].x;
      const s = sae(pts, kk, bb);
      if (!best || s < best.sae) best = { k: kk, b: bb, sae: s };
    }
  }
  return best;
}

// ---- 逐步拟合:两个「迈一步」按钮各调用一次,都走「试探法」 ----

// 清空拟合进度(重置数据、拖动手柄、增删点后调用),试探步长恢复初值
function resetStep() {
  stepMethod = null; stepCount = 0; stepInfo = null;
  probeK = PROBE_K0; probeB = PROBE_B0;
}

// 按钮入口:让蓝线朝 method 的目标(L2→SSE,L1→SAE)试探一步,并记录细节
function doStep(method) {
  const pts = ptNames.map(n => viz.units(n));
  if (pts.length < 2) { stepInfo = { err: '至少要有 2 个点才能拟合' }; return; }
  deriveLineFromHandles();                       // 以手柄当前位置为这一步的起点
  if (stepMethod !== method) { stepCount = 0; probeK = PROBE_K0; probeB = PROBE_B0; }
  stepMethod = method;
  const objFn = method === 'L2' ? sse : sae;      // 目标误差:平方和 / 绝对值和
  const info = hillStep(pts, objFn, method);
  syncLineHandles();                              // 端点贴回新直线,draw 里派生出的就是它
  stepCount++;
  info.n = stepCount;
  stepInfo = info;
}

// 试探法(爬山)一步:把直线朝四个方向各试探一点——斜率 k 加/减 probeK、
// 截距 b 加/减 probeB,分别算目标误差,保留最小的那个方向;若四个方向都没让误差
// 变小(卡在谷底附近),就原地把两个试探步长各减半,下一次试得更精细。
// 全程只用到"算误差"与"比大小",不涉及任何导数。
function hillStep(pts, objFn, method) {
  const k0 = k, b0 = b, E0 = objFn(pts, k, b);
  const cand = [
    { tag: 'k−', k: k - probeK, b: b },
    { tag: 'k+', k: k + probeK, b: b },
    { tag: 'b−', k: k, b: b - probeB },
    { tag: 'b+', k: k, b: b + probeB },
  ];
  for (const c of cand) c.E = objFn(pts, c.k, c.b);
  const trials = { km: cand[0].E, kp: cand[1].E, bm: cand[2].E, bp: cand[3].E };
  let best = cand[0];
  for (const c of cand) if (c.E < best.E) best = c;

  let chosen, shrunk = false;
  if (best.E < E0 - 1e-12) {                       // 有更好的方向:挪过去,并给该方向加速
    k = best.k; b = best.b; chosen = best.tag;
    if (best.tag === 'k−' || best.tag === 'k+') probeK *= PROBE_GROW; else probeB *= PROBE_GROW;
  } else {                                          // 四个方向都没更好:原地把试探步长减半
    chosen = 'none'; shrunk = true;
    probeK *= 0.5; probeB *= 0.5;
  }
  return {
    method, k0, b0, k1: k, b1: b, obj0: E0, obj1: objFn(pts, k, b),
    objName: method === 'L2' ? 'SSE' : 'SAE',
    trials, chosen, shrunk, probeK, probeB,
  };
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

function updatePanel(pts, best, bestL1) {
  set('k', k.toFixed(2));
  set('vb', b.toFixed(2));
  set('sse', sse(pts, k, b).toFixed(2));
  set('vsae', sae(pts, k, b).toFixed(2));
  set('kbest', best ? best.k.toFixed(2) : '—');
  set('bbest', best ? best.b.toFixed(2) : '—');
  set('ssebest', best ? best.sse.toFixed(2) : '—');
  set('kbestL1', bestL1 ? bestL1.k.toFixed(2) : '—');
  set('bbestL1', bestL1 ? bestL1.b.toFixed(2) : '—');
  set('saebest', bestL1 ? bestL1.sae.toFixed(2) : '—');
  renderStepLog(best, bestL1);
  updateButtons();
}

// 已收敛到最优时,禁用当前方法对应的「试探一步」按钮(灰掉、不能再点)。
// 换方法 / 拖动 / 增删点都会复位 probe,下一帧自动恢复可点。
function updateButtons() {
  const converged = probeK < CONV_TOL && probeB < CONV_TOL;
  document.getElementById('btn-fit-l2').disabled = (stepMethod === 'L2' && converged);
  document.getElementById('btn-fit-l1').disabled = (stepMethod === 'L1' && converged);
}

// 把最近一步的详细信息渲染到面板的「拟合步骤」区
function renderStepLog(best, bestL1) {
  const el = document.getElementById('steplog-body');
  const s = stepInfo;
  if (!s) { el.innerHTML = '还没开始 —— 点下方按钮,让蓝线朝目标迈一步。'; return; }
  if (s.err) { el.innerHTML = `<span class="sl-warn">${s.err}</span>`; return; }

  const dk = s.k1 - s.k0, db = s.b1 - s.b0;
  const stepLen = Math.hypot(dk, db);
  const dObj = s.obj0 - s.obj1;                       // 正 = 误差下降
  const pct = s.obj0 > 1e-9 ? Math.abs(dObj) / s.obj0 * 100 : 0;
  const arrow = dObj >= 0 ? '↓' : '↑', word = dObj >= 0 ? '降' : '增';
  const on = s.method === 'L2';
  const opt = on ? best : bestL1;
  const t = s.trials;
  // 命中方向标绿,其余灰;卡壳(chosen='none')则全灰
  const mark = tag => (s.chosen === tag ? 'sl-hit' : 'sl-mut');

  let h = '';
  h += `<div class="sl-h ${on ? 'sum' : 'lad'}">${on ? '最小二乘 L2' : '最小绝对偏差 L1'} · 试探法 —— 第 ${s.n} 步</div>`;
  h += `<div class="sl-mut">朝四个方向各试探一点,看 ${s.objName} 谁最小(当前 ${s.obj0.toFixed(2)}):</div>`;
  h += `<div>斜率 <span class="${mark('k−')}">k−:${t.km.toFixed(2)}</span> · <span class="${mark('k+')}">k+:${t.kp.toFixed(2)}</span></div>`;
  h += `<div>截距 <span class="${mark('b−')}">b−:${t.bm.toFixed(2)}</span> · <span class="${mark('b+')}">b+:${t.bp.toFixed(2)}</span></div>`;
  if (s.chosen === 'none') {
    h += `<div class="sl-warn">四个方向都没更好 → 试探步长减半,试得更细</div>`;
  } else {
    h += `<div>最好的是 <b>${s.chosen}</b>,采用</div>`;
  }
  h += `<div class="sl-sep"></div>`;
  h += `<div>k: ${s.k0.toFixed(3)} → <b>${s.k1.toFixed(3)}</b> <span class="sl-mut">(Δk ${signed(dk)})</span></div>`;
  h += `<div>b: ${s.b0.toFixed(3)} → <b>${s.b1.toFixed(3)}</b> <span class="sl-mut">(Δb ${signed(db)})</span></div>`;
  h += `<div>走了多大步 |Δ(k,b)| = <b>${stepLen.toFixed(4)}</b></div>`;
  h += `<div class="sl-mut">当前试探步长 δk=${s.probeK.toFixed(3)}, δb=${s.probeB.toFixed(3)}</div>`;
  h += `<div class="sl-sep"></div>`;
  h += `<div>${s.objName}: ${s.obj0.toFixed(3)} → <b>${s.obj1.toFixed(3)}</b> <span class="sl-down">${arrow} ${word} ${pct.toFixed(1)}%</span></div>`;
  if (opt) {
    h += `<div class="sl-mut">离最优还差:|k−k*| = ${Math.abs(s.k1 - opt.k).toFixed(3)} , |b−b*| = ${Math.abs(s.b1 - opt.b).toFixed(3)}</div>`;
    if (s.probeK < CONV_TOL && s.probeB < CONV_TOL) h += `<div class="sl-done">试探步长≈0,已收敛到最优 ✓(按钮已锁定)</div>`;
  }
  el.innerHTML = h;
}

// ---- 小工具 ----
const set = (id, txt) => { document.getElementById(id).textContent = txt; };
const checked = id => document.getElementById(id).checked;
// 带正负号,负号用真减号
const signed = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3);

// ---- 交互:拖拽 / 点空白加点 / 双击删点 ----
function mousePressed() {
  viz.onPressed();
  if (viz.isDragging()) { resetStep(); return; }       // 用户接管,清空拟合进度
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
  if (ptNames.length >= MAX_PTS) return;
  const u = viz.toUnits(viz.toLocal(mouseX, mouseY));
  addPoint(Math.round(u.x * 2) / 2, Math.round(u.y * 2) / 2);   // 吸附到 0.5
  resetStep();
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
      resetStep();
      return;
    }
  }
}
