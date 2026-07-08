// demos/dot-product/sketch.js
// 向量加法与点积:两个可拖动向量,展示 a+b、夹角、以及点积 = 投影。

let viz;
const COL = {};

function setup() {
  const c = createCanvas(560, 560);
  c.parent('canvas-holder');

  COL.a = color(255, 107, 107);
  COL.b = color(77, 171, 247);
  COL.sum = color(81, 207, 102);
  COL.proj = color(255, 212, 59);
  COL.white = color(255);

  viz = MathViz({ size: 560, unit: 40 });
  viz.addHandle('a', 3, 1, COL.a);    // 初始 a = (3, 1)
  viz.addHandle('b', 1, -2, COL.b);   // 初始 b = (1, -2)

  KatexSetup();
}

function draw() {
  background(15, 17, 23);
  viz.drawGrid();

  const O = createVector(0, 0);
  const aP = viz.handle('a'), bP = viz.handle('b');

  // 平行四边形 a + b
  if (checked('showSum')) {
    const sum = p5.Vector.add(aP, bP);
    viz.dashedLine(aP, sum, COL.sum, 90);
    viz.dashedLine(bP, sum, COL.sum, 90);
    viz.arrow(O, sum, COL.sum);
  }

  // 投影:a 在 b 方向上的投影向量(点积的几何意义)
  if (checked('showProj') && bP.mag() > 1) {
    const bUnit = bP.copy().normalize();
    const proj = bUnit.copy().mult(p5.Vector.dot(aP, bUnit));
    viz.dashedLine(aP, proj, COL.white, 70);   // a 端点到投影点的垂线
    viz.arrow(O, proj, COL.proj, 5);
  }

  viz.arrow(O, aP, COL.a);
  viz.arrow(O, bP, COL.b);
  viz.drawHandles();

  updatePanel(viz.units('a'), viz.units('b'));
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

// ---- 拖拽事件转发给公共层 ----
function mousePressed() { viz.onPressed(); }
function mouseDragged() { viz.onDragged(); }
function mouseReleased() { viz.onReleased(); }
