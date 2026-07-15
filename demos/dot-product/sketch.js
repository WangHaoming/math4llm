// demos/dot-product/sketch.js
// 向量加法与点积:两个可拖动向量,展示 a+b、夹角、以及点积 = 投影。
// 「证明演示」:整个图形刚性旋转(夹角不变)把 b 转到 x 轴上,
// 标注 a·b = |a|cosθ×|b| + |a|sinθ×0 = |a||b|cosθ 的各步计算。

let viz;
const COL = {};
let proofT = 0;   // 证明演示动画进度:0 = 原始坐标,1 = b 躺平在 x 轴上

// 画布尺寸 = 容器 #canvas-holder 的实际大小(随窗口伸缩)
function holderSize() {
  const el = document.getElementById('canvas-holder');
  return { w: Math.max(320, el.clientWidth), h: Math.max(320, el.clientHeight) };
}

function setup() {
  const { w, h } = holderSize();
  const c = createCanvas(w, h);
  c.parent('canvas-holder');

  COL.a = color(255, 107, 107);
  COL.b = color(77, 171, 247);
  COL.sum = color(81, 207, 102);
  COL.proj = color(255, 212, 59);
  COL.white = color(255);

  viz = MathViz({ w, h, unit: 40 });
  viz.addHandle('a', 3, 1, COL.a);    // 初始 a = (3, 1)
  viz.addHandle('b', 1, -2, COL.b);   // 初始 b = (1, -2)

  // 画布跟随容器尺寸(MathViz 原点保持居中)。用 ResizeObserver 而非 p5 的
  // windowResized:加载过程中面板宽度会变(如 KaTeX 渲染前后),那不触发窗口事件
  new ResizeObserver(() => {
    const s = holderSize();
    if (s.w !== width || s.h !== height) { resizeCanvas(s.w, s.h); viz.resize(s.w, s.h); }
  }).observe(document.getElementById('canvas-holder'));

  KatexSetup();
}

function draw() {
  background(15, 17, 23);
  viz.drawGrid();
  viz.drawTicks();

  const O = createVector(0, 0);
  const aP = viz.handle('a'), bP = viz.handle('b');

  // 证明演示:动画推进/回退(b 太短时不进入,避免方位角失义)
  const proofOn = checked('showProof') && bP.mag() > 1;
  proofT = Math.max(0, Math.min(1, proofT + (proofOn ? 0.035 : -0.07)));
  document.getElementById('proof-box').style.display = checked('showProof') ? '' : 'none';
  const inProof = proofT > 0.001;

  // 平行四边形 a + b(证明演示期间暂隐,避免画面混乱)
  if (!inProof && checked('showSum')) {
    const sum = p5.Vector.add(aP, bP);
    viz.dashedLine(aP, sum, COL.sum, 90);
    viz.dashedLine(bP, sum, COL.sum, 90);
    viz.arrow(O, sum, COL.sum);
  }

  // 投影:a 在 b 方向上的投影向量(点积的几何意义)
  if (!inProof && checked('showProj') && bP.mag() > 1) {
    const bUnit = bP.copy().normalize();
    const proj = bUnit.copy().mult(p5.Vector.dot(aP, bUnit));
    viz.dashedLine(aP, proj, COL.white, 70);   // a 端点到投影点的垂线
    viz.arrow(O, proj, COL.proj, 5);
  }

  if (inProof) {
    // 刚性旋转:a、b 同转 −β(β 为 b 的方位角),长度与夹角都不变
    const beta = Math.atan2(bP.y, bP.x);
    const t = proofT * proofT * (3 - 2 * proofT);   // 平滑缓动
    const rot = -beta * t;
    const ar = aP.copy().rotate(rot), br = bP.copy().rotate(rot);

    // 原始的 a、b 淡显留作参照(端点仍可拖动)
    viz.arrow(O, aP, fade(COL.a, 60));
    viz.arrow(O, bP, fade(COL.b, 60));
    // 旋转后的 a、b
    viz.arrow(O, ar, COL.a);
    viz.arrow(O, br, COL.b);

    if (proofT > 0.999) drawProofMarks(O, ar, br);
    updateProofPanel(aP, bP);
  } else {
    viz.arrow(O, aP, COL.a);
    viz.arrow(O, bP, COL.b);
  }

  viz.drawHandles();
  updatePanel(viz.units('a'), viz.units('b'));
}

// b 已躺平:标注影子、举高、b 的坐标与夹角 θ
function drawProofMarks(O, ar, br) {
  const foot = createVector(ar.x, 0);              // a 端点在 x 轴上的垂足
  viz.arrow(O, foot, COL.proj, 5);                 // 影子 |a|cosθ(黄)
  viz.dashedLine(ar, foot, COL.white, 90);         // 举高 |a|sinθ(乘 0 被丢弃)

  const au = viz.toUnits(ar);
  // 标注一律用符号形式(与 README 3.3 的证明步骤一一对应),具体数值看面板;
  // 影子与 b 的标签分两行错开,避免二者在 x 轴下方重叠
  viz.label(createVector(ar.x / 2, 0), `|a|·cosθ = ${au.x.toFixed(2)}`, COL.proj, 0, 20);
  viz.label(createVector(ar.x, ar.y / 2), `|a|·sinθ = ${au.y.toFixed(2)}`, COL.white, ar.y >= 0 ? 62 : -62, 0);
  viz.label(br, 'b = (|b|, 0)', COL.b, 0, 42);
  viz.label(ar, 'a = (|a|cosθ, |a|sinθ)', COL.a, 0, ar.y >= 0 ? -16 : 16);

  // 夹角 θ 圆弧(屏幕坐标 y 向下,数学角取负)
  const angA = Math.atan2(ar.y, ar.x);
  const s0 = viz.toScreen(createVector(0, 0));
  push(); noFill(); stroke(255, 255, 255, 110); strokeWeight(1.5);
  if (angA >= 0) arc(s0.x, s0.y, 64, 64, -angA, 0);
  else arc(s0.x, s0.y, 64, 64, 0, -angA);
  pop();
  viz.label(createVector(Math.cos(angA / 2) * 46, Math.sin(angA / 2) * 46), 'θ', COL.white);
}

// 步骤面板:数值按"转完之后"的目标坐标计算(动画过程中保持稳定)
function updateProofPanel(aP, bP) {
  const beta = Math.atan2(bP.y, bP.x);
  const ar = viz.toUnits(aP.copy().rotate(-beta));   // 躺平坐标系里的 a
  const magB = viz.toUnits(bP).mag();                // |b|(长度不因旋转改变)

  set('pfB', `(${magB.toFixed(2)}, 0)`);
  set('pfA', `(${ar.x.toFixed(2)}, ${ar.y.toFixed(2)})`);
  set('pfCalc', `${ar.x.toFixed(2)}×${magB.toFixed(2)} + ${ar.y.toFixed(2)}×0`);
  set('pfRes', `= ${(ar.x * magB).toFixed(2)}(与转轴前的 a·b 相同)`);
}

function updatePanel(a, b) {
  const fmt = (x, y) => `(${x.toFixed(2)}, ${y.toFixed(2)})`;
  const dot = a.x * b.x + a.y * b.y;
  const magA = Math.hypot(a.x, a.y), magB = Math.hypot(b.x, b.y);
  const cos = (magA && magB) ? dot / (magA * magB) : 0;
  const theta = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
  const scalarProj = magB ? dot / magB : 0;   // a 在 b 上的标量投影

  set('va', fmt(a.x, a.y));
  set('vb', fmt(b.x, b.y));
  set('vsum', fmt(a.x + b.x, a.y + b.y));
  set('dot', dot.toFixed(2));
  set('theta', theta.toFixed(1) + '°');
  set('proj', scalarProj.toFixed(2));
}

// ---- 小工具 ----
const set = (id, txt) => { document.getElementById(id).textContent = txt; };
const checked = id => document.getElementById(id).checked;
const fade = (c, a) => color(red(c), green(c), blue(c), a);

// ---- 拖拽事件转发给公共层 ----
function mousePressed() { viz.onPressed(); }
function mouseDragged() { viz.onDragged(); }
function mouseReleased() { viz.onReleased(); }
