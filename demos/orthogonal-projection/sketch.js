// demos/orthogonal-projection/sketch.js
// 最小二乘 = 正交投影:把 3 个样本的真实值打包成一个三维向量 y,
// 模型 ŷ = k·x + b·1 能产生的所有预测组成一张二维平面(模型平面)。
// 拖动 k、b 滑块,让预测点 ŷ 在这张平面上滑动;残差线段 e = y − ŷ 的颜色
// 随"垂直程度"由灰变绿 —— 完全垂直(e·x=0 且 e·1=0)那一刻,就是最小二乘解。
//
// 为了让 3D 场景不那么抽象,这里做了几件事:
// - 左上角有一个 2D 小窗,画的是熟悉的"散点 + 直线"视角,与滑块实时同步;
// - 场景内的关键点用 HTML 悬浮标签直接标名(WEBGL 文字需要加载字体且中文
//   字体太大,改为把世界坐标投影到屏幕坐标、摆放 DOM 标签);
// - 常驻画出 y、ŷ、垂足 ŷ* 组成的直角三角形:绿色虚线是垂线(最短),
//   橙色虚线是躺在平面内的误差,灰色实线是斜边——"斜边永远比直角边长"
//   就是"最优预测 = 垂足"的全部理由;
// - 相机按数据自动取景:以平面法线方向为"上",从侧上方俯视,平面看起来
//   是一张摊开的"地面",y 悬在上方。

let data;               // 当前数据集派生出的所有向量/范围,见 buildData()
let presetIdx = 0;
let anim = null;        // 跳到最优解 / 重置 的过渡动画:{k0,b0,k1,b1,t0,dur}
let viewMV = null;      // 每帧 orbitControl 之后的视图/投影矩阵快照,供标签投影用
let viewPM = null;
let labels = {};        // id -> DOM 元素
const unit = 55;        // 1 个数学单位 = 多少像素

// 三组内置数据(样本 x 固定为 1,2,3;每组给出对应的 y)。
// k、b 滑块范围不写死,由 buildData() 以最优解 (k*,b*) 为中心自动展开一圈,
// 这样无论换哪组数据,模型平面的可视范围都稳定地围着"标准答案"展开。
const PRESETS = [
  { points: [[1, 2], [2, 3], [3, 5]] },
  { points: [[1, 1], [2, 4], [3, 3]] },
  { points: [[1, 4], [2, 1], [3, 2]] },
];

function holderSize() {
  const el = document.getElementById('canvas-holder');
  return { w: Math.max(320, el.clientWidth), h: Math.max(320, el.clientHeight) };
}

function setup() {
  const { w, h } = holderSize();
  const c = createCanvas(w, h, WEBGL);
  c.parent('canvas-holder');

  makeLabels();

  // 支持 ?preset=n 直接打开某组数据(也方便截图验证)
  const q = parseInt(new URLSearchParams(location.search).get('preset'));
  applyPreset(Number.isInteger(q) ? ((q % PRESETS.length) + PRESETS.length) % PRESETS.length : 0);

  document.getElementById('btnJump').onclick = () => {
    anim = { k0: currentK(), b0: currentB(), k1: data.kStar, b1: data.bStar, t0: millis(), dur: 700 };
  };
  document.getElementById('btnReset').onclick = () => {
    // 退到滑块范围的起点(远离最优解那一角),而不是固定的 (0,0)——
    // 换数据集后 k*、b* 会变,滑块范围也跟着以它为中心平移,0 不一定还在范围内
    anim = { k0: currentK(), b0: currentB(), k1: data.kMin, b1: data.bMin, t0: millis(), dur: 500 };
  };
  document.getElementById('btnPreset').onclick = () => {
    presetIdx = (presetIdx + 1) % PRESETS.length;
    applyPreset(presetIdx);
  };

  new ResizeObserver(() => {
    const s = holderSize();
    if (s.w !== width || s.h !== height) { resizeCanvas(s.w, s.h); frameCamera(); }
  }).observe(document.getElementById('canvas-holder'));

  KatexSetup();
}

// ---- 数据集:由 (x_i, y_i) 三点算出闭式解 k*、b*,以及绘图所需的向量 ----
function solveLS(xs, ys) {
  const n = xs.length;
  let Sxx = 0, Sx = 0, Sxy = 0, Sy = 0;
  for (let i = 0; i < n; i++) { Sxx += xs[i] * xs[i]; Sx += xs[i]; Sxy += xs[i] * ys[i]; Sy += ys[i]; }
  const det = Sxx * n - Sx * Sx;
  return { k: (Sxy * n - Sx * Sy) / det, b: (Sxx * Sy - Sx * Sxy) / det };
}

function buildData(preset) {
  const xs = preset.points.map(p => p[0]);
  const ys = preset.points.map(p => p[1]);
  const { k: kStar, b: bStar } = solveLS(xs, ys);
  const xVec = createVector(xs[0], xs[1], xs[2]);
  const oneVec = createVector(1, 1, 1);
  const yVec = createVector(ys[0], ys[1], ys[2]);
  // 模型平面的一组正交基(Gram-Schmidt),用来算"残差落在平面内的分量"
  const e1 = xVec.copy().normalize();
  const e2raw = p5.Vector.sub(oneVec, p5.Vector.mult(e1, p5.Vector.dot(oneVec, e1)));
  const e2 = e2raw.copy().normalize();
  const yhatStar = p5.Vector.add(p5.Vector.mult(xVec, kStar), p5.Vector.mult(oneVec, bStar));
  // 平面法线,取朝向"y 戳出平面的那一侧"(即与最优残差同向)
  const normal = e1.cross(e2).normalize();
  const eStar = p5.Vector.sub(yVec, yhatStar);
  if (p5.Vector.dot(normal, eStar) < 0) normal.mult(-1);
  // 滑块范围:以最优解为中心展开一圈,保证无论换哪组数据,可视范围都稳定
  // 围着"标准答案"展开
  const kSpan = 1.0, bSpan = 1.2;
  // 模型平面的可视补丁:注意不能按 (k,b) 矩形画——x 和 1 两个方向只差
  // 二十多度,(k,b) 矩形在平面上是一条剪切得极扁的斜条,怎么摆相机都像
  // 细带。补丁改为沿正交基 (e1,e2) 的规整矩形,以垂足为中心,大小取到
  // 恰好盖住滑块能到达的所有 ŷ
  const xMag = xVec.mag(), oneDotE1 = p5.Vector.dot(oneVec, e1);
  const aSpan = kSpan * xMag + bSpan * Math.abs(oneDotE1) + 0.5;
  const b2Span = Math.max(aSpan * 0.52, bSpan * e2raw.mag() + 0.5);
  return {
    points: preset.points, xs, ys, xVec, oneVec, yVec, kStar, bStar, e1, e2, yhatStar, normal,
    kMin: kStar - kSpan, kMax: kStar + kSpan, bMin: bStar - bSpan, bMax: bStar + bSpan,
    aSpan, b2Span,
  };
}

function applyPreset(idx) {
  presetIdx = idx;
  data = buildData(PRESETS[idx]);
  anim = null;

  const ks = document.getElementById('kSlider'), bs = document.getElementById('bSlider');
  ks.min = data.kMin; ks.max = data.kMax; ks.value = data.kMin;
  bs.min = data.bMin; bs.max = data.bMax; bs.value = data.bMin;

  set('ptsText', data.points.map(p => `(${p[0]}, ${p[1]})`).join('  '));
  set('kStarText', data.kStar.toFixed(3));
  set('bStarText', data.bStar.toFixed(3));
  set('vYhatStar', fmt3(data.yhatStar));

  frameCamera();
}

// ---- 相机自动取景:从侧上方俯视,把整个场景框进画面 ----
// 注意:绘制坐标系已经由 P() 旋转到与模型平面对齐(平面=水平地面),
// 所以这里只需要一个普通的"斜上方俯视"机位;orbitControl 假设世界 y 轴
// 朝上,与这个坐标系天然一致(自定义 up 向量会被 orbitControl 覆盖,不可用)。
function frameCamera() {
  if (!data || !width) return;
  const Py = P(data.yVec), Pf = P(data.yhatStar);
  // 视线中心:原点、真实值 y、垂足 三者的质心(都是场景里最重要的点)
  const C = createVector((Py.x + Pf.x) / 3, (Py.y + Pf.y) / 3, (Py.z + Pf.z) / 3);
  // 包围半径:平面补丁四角 + y + 原点 到中心的最远距离
  const A = data.aSpan, B = data.b2Span;
  const pts = [
    P(planePoint(-A, -B)), P(planePoint(A, -B)),
    P(planePoint(A, B)), P(planePoint(-A, B)),
    Py, createVector(0, 0, 0),
  ];
  let R = 0;
  for (const p of pts) R = Math.max(R, p5.Vector.dist(p, C));
  // 侧上方 ~55° 俯视(p5 的 y 轴朝下,"上方"是 -y);x 偏移只留一点点,
  // 偏多了整块"地面"会在画面里斜成对角带
  const eyeDir = createVector(0.15, -0.85, 0.58).normalize();
  const d = Math.max(500, R * 2.2);   // p5 默认透视 fov = PI/3,2.2R 足够留边
  const eye = p5.Vector.add(C, p5.Vector.mult(eyeDir, d));
  camera(eye.x, eye.y, eye.z, C.x, C.y, C.z, 0, 1, 0);
}

function yhatOf(k, b) {
  return p5.Vector.add(p5.Vector.mult(data.xVec, k), p5.Vector.mult(data.oneVec, b));
}

// 残差 e 落在模型平面内的分量占比:1 = 完全垂直于平面(=最优解),0 = 完全躺在平面内
function perpRatio(e) {
  const mag = e.mag();
  if (mag < 1e-6) return 1;
  const inplane = p5.Vector.add(
    p5.Vector.mult(data.e1, p5.Vector.dot(e, data.e1)),
    p5.Vector.mult(data.e2, p5.Vector.dot(e, data.e2)),
  );
  return p5.Vector.sub(e, inplane).mag() / mag;
}

function draw() {
  background(15, 17, 23);
  orbitControl(1, 1, 0.25);

  // 此刻还没做任何模型变换,uMVMatrix 就是纯视图矩阵——快照下来给标签投影用
  const r = p5.instance._renderer;
  viewMV = r.uMVMatrix.mat4.slice();
  viewPM = r.uPMatrix.mat4.slice();

  // 跳到最优解 / 重置:缓动过渡,同步写回滑块,让面板数值跟着动画走
  if (anim) {
    const t = Math.min(1, (millis() - anim.t0) / anim.dur);
    const e = t * t * (3 - 2 * t);
    const k = lerp(anim.k0, anim.k1, e), b = lerp(anim.b0, anim.b1, e);
    document.getElementById('kSlider').value = k;
    document.getElementById('bSlider').value = b;
    if (t >= 1) anim = null;
  }

  const k = currentK(), b = currentB();
  const yh = yhatOf(k, b);
  const e = p5.Vector.sub(data.yVec, yh);
  const t = perpRatio(e);
  const nearFoot = p5.Vector.dist(yh, data.yhatStar) < 0.06;

  drawRefAxes();
  drawPlane();

  // "走两步"合成路径:原点 --k·x--> 转角 --b·1--> ŷ(对应 README 的"走两步")
  const showPath = document.getElementById('chkPath').checked;
  const corner = p5.Vector.mult(data.xVec, k);
  if (showPath) {
    drawFatLine(createVector(0, 0, 0), corner, color(77, 171, 247, 150), 6);
    drawFatLine(corner, yh, color(177, 151, 252, 150), 6);
  }

  const O = createVector(0, 0, 0);
  drawArrow(O, data.xVec, color(77, 171, 247), 3);     // x 方向:蓝
  drawArrow(O, data.oneVec, color(177, 151, 252), 3);  // 1 方向:紫
  drawArrow(O, data.yVec, color(255, 107, 107), 4);    // 真实值 y:红

  // 直角三角形:y—ŷ(斜边)、y—垂足(垂线,最短)、垂足—ŷ(平面内误差)。
  // 斜边永远比垂线长,这就是"最优预测 = 垂足"的几何理由。
  if (!nearFoot) {
    drawTriangle(data.yVec, yh, data.yhatStar, color(255, 169, 77, 18));
    drawDashedLine(data.yhatStar, yh, color(255, 169, 77, 220), 2.5, 9);   // 平面内误差:橙
    drawRightAngle(data.yhatStar, data.yVec, yh);
  }
  drawDashedLine(data.yVec, data.yhatStar, color(81, 207, 102, 230), 2.5, 9); // 垂线:绿

  drawWireDot(data.yhatStar, color(81, 207, 102), 9);  // 最优投影点(垂足):绿色线框球
  drawDot(yh, color(255, 212, 59), 6);                 // 当前预测 ŷ:黄

  push();
  const pf = P(yh), pt = P(data.yVec);
  stroke(residualColor(t)); strokeWeight(3.5);
  line(pf.x, pf.y, pf.z, pt.x, pt.y, pt.z);
  pop();

  drawInset(k, b);
  updateLabels(k, b, yh, e, t, corner, showPath, nearFoot);
  updatePanel(k, b, yh, e, t);

  // ?dbg:把关键点的屏幕坐标写进标题,供 headless 截图调试取景用
  if (location.search.includes('dbg')) {
    const s = v => { const p = worldToScreen(v); return p ? [Math.round(p.x), Math.round(p.y)] : null; };
    const cam = p5.instance._renderer._curCamera;
    document.title = JSON.stringify({
      c00: s(yhatOf(data.kMin, data.bMin)), c10: s(yhatOf(data.kMax, data.bMin)),
      c11: s(yhatOf(data.kMax, data.bMax)), c01: s(yhatOf(data.kMin, data.bMax)),
      y: s(data.yVec), foot: s(data.yhatStar), O: s(createVector(0, 0, 0)),
      cam: [cam.eyeX, cam.eyeY, cam.eyeZ, cam.centerX, cam.centerY, cam.centerZ,
        cam.upX, cam.upY, cam.upZ].map(v => Math.round(v)),
      wh: [width, height],
    });
  }
}

// ---- 三维绘制小工具(所有向量以"数学单位"传入,内部再乘 unit 转成像素) ----
// P() 同时做一次基变换,把"样本坐标系"旋转到与模型平面对齐:
//   平面长轴 e1 → 屏幕坐标 x,平面短轴 e2 → 屏幕坐标 z(景深),
//   平面法线 → -y(p5 的 y 轴朝下,-y 即"竖直向上")。
// 于是模型平面永远是水平的"地面",残差垂直向上戳出,俯视机位一眼看懂;
// 三条样本参考轴经过同一变换后呈倾斜状——它们本来就相对平面倾斜。
function P(v) {
  const a = p5.Vector.dot(v, data.e1);
  const b = p5.Vector.dot(v, data.e2);
  const c = p5.Vector.dot(v, data.normal);
  return createVector(a * unit, -c * unit, b * unit);
}

function drawArrow(from, to, col, w) {
  const f = P(from), tt = P(to);
  push();
  stroke(col); strokeWeight(w);
  line(f.x, f.y, f.z, tt.x, tt.y, tt.z);
  pop();
  // 端点的小圆锥箭头:把圆锥的 +Y 轴转到线段方向上,锥尖落在端点
  const dir = p5.Vector.sub(tt, f);
  if (dir.mag() > 1) {
    dir.normalize();
    const h = 14;
    push();
    translate(tt.x, tt.y, tt.z);
    const yAxis = createVector(0, 1, 0);
    const axis = yAxis.cross(dir);
    const ang = Math.acos(constrain(yAxis.dot(dir), -1, 1));
    if (axis.mag() > 1e-6) rotate(ang, [axis.x, axis.y, axis.z]);
    else if (dir.y < 0) rotate(Math.PI, [1, 0, 0]);
    translate(0, -h / 2, 0);
    noStroke(); fill(col);
    cone(w * 2.1, h, 10, 1);
    pop();
  }
}

function drawFatLine(from, to, col, w) {
  push();
  const f = P(from), tt = P(to);
  stroke(col); strokeWeight(w);
  line(f.x, f.y, f.z, tt.x, tt.y, tt.z);
  pop();
}

function drawDashedLine(from, to, col, w, dashPx) {
  const A = P(from), B = P(to);
  const len = p5.Vector.dist(A, B);
  const n = Math.max(1, Math.round(len / dashPx));
  push();
  stroke(col); strokeWeight(w);
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = Math.min(1, (i + 0.55) / n);
    const pA = p5.Vector.lerp(A, B, t0), pB = p5.Vector.lerp(A, B, t1);
    line(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
  }
  pop();
}

function drawTriangle(a, b, c, col) {
  const A = P(a), B = P(b), C = P(c);
  push();
  noStroke(); fill(col);
  beginShape();
  vertex(A.x, A.y, A.z); vertex(B.x, B.y, B.z); vertex(C.x, C.y, C.z);
  endShape(CLOSE);
  pop();
}

// 垂足处的直角标记:在 (foot→a) 与 (foot→b) 张成的角上画一个小方角
function drawRightAngle(foot, a, b) {
  const u = p5.Vector.sub(a, foot), v = p5.Vector.sub(b, foot);
  if (u.mag() < 0.15 || v.mag() < 0.15) return;
  u.normalize().mult(0.22); v.normalize().mult(0.22);
  const p1 = p5.Vector.add(foot, u);
  const p2 = p5.Vector.add(p5.Vector.add(foot, u), v);
  const p3 = p5.Vector.add(foot, v);
  push();
  stroke(230, 235, 245, 200); strokeWeight(1.5);
  const q1 = P(p1), q2 = P(p2), q3 = P(p3);
  line(q1.x, q1.y, q1.z, q2.x, q2.y, q2.z);
  line(q2.x, q2.y, q2.z, q3.x, q3.y, q3.z);
  pop();
}

function drawDot(v, col, r) {
  push();
  const p = P(v);
  translate(p.x, p.y, p.z);
  noStroke(); fill(col);
  sphere(r, 12, 8);
  pop();
}

function drawWireDot(v, col, r) {
  push();
  const p = P(v);
  translate(p.x, p.y, p.z);
  noFill(); stroke(col); strokeWeight(2);
  sphere(r, 10, 8);
  pop();
}

// 平面上以垂足为中心、沿正交基 (e1, e2) 走 (u, v) 的点
function planePoint(u, v) {
  return p5.Vector.add(data.yhatStar,
    p5.Vector.add(p5.Vector.mult(data.e1, u), p5.Vector.mult(data.e2, v)));
}

function drawPlane() {
  const A = data.aSpan, B = data.b2Span;
  const c00 = P(planePoint(-A, -B));
  const c10 = P(planePoint(A, -B));
  const c11 = P(planePoint(A, B));
  const c01 = P(planePoint(-A, B));

  push();
  noStroke(); fill(77, 171, 247, 32);
  beginShape();
  vertex(c00.x, c00.y, c00.z); vertex(c10.x, c10.y, c10.z);
  vertex(c11.x, c11.y, c11.z); vertex(c01.x, c01.y, c01.z);
  endShape(CLOSE);
  pop();

  push();
  noFill(); stroke(77, 171, 247, 90); strokeWeight(1);
  const stepsU = 10, stepsV = 6;
  for (let i = 0; i <= stepsU; i++) {
    const u = lerp(-A, A, i / stepsU);
    const a = P(planePoint(u, -B)), b2 = P(planePoint(u, B));
    line(a.x, a.y, a.z, b2.x, b2.y, b2.z);
  }
  for (let j = 0; j <= stepsV; j++) {
    const v = lerp(-B, B, j / stepsV);
    const a = P(planePoint(-A, v)), b2 = P(planePoint(A, v));
    line(a.x, a.y, a.z, b2.x, b2.y, b2.z);
  }
  pop();
}

// 三条穿过原点的淡灰参考线:三个坐标分别对应三个样本的 y 值(见轴端标签 y₁ y₂ y₃)
function drawRefAxes() {
  push();
  stroke(90, 96, 120, 130); strokeWeight(1);
  const L = axisLen();
  [createVector(L, 0, 0), createVector(0, L, 0), createVector(0, 0, L)].forEach(d => {
    const p1 = P(d), p2 = P(p5.Vector.mult(d, -0.35));
    line(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
  });
  pop();
}

function axisLen() { return Math.max(...data.ys) * 0.75; }

function residualColor(t) {
  return lerpColor(color(154, 160, 180), color(81, 207, 102), constrain(t, 0, 1));
}

// ---- 场景内 HTML 标签:世界坐标 → 屏幕坐标,摆放 DOM 元素 ----
// (WEBGL 里画中文文字需要加载大字体文件,DOM 标签更轻也更清晰。
//  投影用 p5 内部的视图/投影矩阵快照;p5 版本已通过 CDN 锁定 1.9.4。)
function makeLabels() {
  const layer = document.getElementById('labelLayer');
  const defs = [
    ['lY',    'y 真实值',   '#ff6b6b', false],
    ['lYh',   'ŷ 当前预测', '#ffd43b', false],
    ['lFoot', '垂足 ŷ*(最优)', '#51cf66', false],
    ['lX',    'x',          '#4dabf7', false],
    ['lOne',  '1',          '#b197fc', false],
    ['lPlane','模型平面',   'rgba(120,178,235,.8)', true],
    ['lE',    'e 残差',     '#9aa0b4', false],
    ['lKx',   'k·x',        'rgba(77,171,247,.9)', true],
    ['lB1',   'b·1',        'rgba(177,151,252,.9)', true],
    ['lA1',   'y₁',         '#6a7086', true],
    ['lA2',   'y₂',         '#6a7086', true],
    ['lA3',   'y₃',         '#6a7086', true],
  ];
  for (const [id, txt, col, small] of defs) {
    const el = document.createElement('div');
    el.className = 'tag3d' + (small ? ' small' : '');
    el.textContent = txt;
    el.style.color = col;
    layer.appendChild(el);
    labels[id] = el;
  }
}

// 把"数学单位"的世界坐标投影到画布像素;点在相机背后时返回 null
function worldToScreen(v) {
  if (!viewMV || !viewPM) return null;
  const p = P(v);
  const e = xform4(viewMV, p.x, p.y, p.z, 1);
  const c = xform4(viewPM, e[0], e[1], e[2], e[3]);
  if (c[3] <= 0) return null;
  const nx = c[0] / c[3], ny = c[1] / c[3];
  return { x: (nx * 0.5 + 0.5) * width, y: (0.5 - ny * 0.5) * height };
}

function xform4(m, x, y, z, w) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12] * w,
    m[1] * x + m[5] * y + m[9] * z + m[13] * w,
    m[2] * x + m[6] * y + m[10] * z + m[14] * w,
    m[3] * x + m[7] * y + m[11] * z + m[15] * w,
  ];
}

function placeLabel(el, v, below) {
  const s = v ? worldToScreen(v) : null;
  const pad = 30;
  if (!s || s.x < -pad || s.x > width + pad || s.y < -pad || s.y > height + pad) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  el.style.left = s.x + 'px';
  el.style.top = s.y + 'px';
  // 默认标签放在点的上方;below=true 放到下方,避免和相邻标签叠在一起
  el.style.transform = below ? 'translate(-50%, 45%)' : 'translate(-50%, -130%)';
}

function updateLabels(k, b, yh, e, t, corner, showPath, nearFoot) {
  const L = axisLen();
  placeLabel(labels.lY, data.yVec);
  placeLabel(labels.lYh, yh);
  placeLabel(labels.lFoot, data.yhatStar, true);
  placeLabel(labels.lX, data.xVec);
  placeLabel(labels.lOne, data.oneVec, true);
  placeLabel(labels.lPlane, planePoint(-data.aSpan * 0.72, data.b2Span * 0.72));
  labels.lE.style.color = residualColor(t).toString();
  const eMid = p5.Vector.lerp(yh, data.yVec, 0.5);
  placeLabel(labels.lE, e.mag() > 0.25 ? eMid : null);
  // 合成路径的两段中点标签,只在路径可见且线段足够长时显示
  placeLabel(labels.lKx, showPath && corner.mag() > 0.6 ? p5.Vector.mult(corner, 0.5) : null, true);
  placeLabel(labels.lB1, showPath && Math.abs(b) > 0.35 ? p5.Vector.lerp(corner, yh, 0.5) : null, true);
  placeLabel(labels.lA1, createVector(L, 0, 0), true);
  placeLabel(labels.lA2, createVector(0, L, 0), true);
  placeLabel(labels.lA3, createVector(0, 0, L), true);
  // ŷ 贴住垂足时,ŷ 标签让位(垂足标签在下方,继续显示)
  if (nearFoot) labels.lYh.style.display = 'none';
}

// ---- 左上角 2D 小窗:熟悉的"散点 + 拟合直线"视角,与滑块同步 ----
function drawInset(k, b) {
  const cv = document.getElementById('inset2d');
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height, pad = 14;
  // 数学范围固定:x ∈ [0,4];y 上下各留一截,保证三组预设都放得下
  const x0 = 0, x1 = 4;
  const yLo = Math.min(0, Math.min(...data.ys)) - 1.2;
  const yHi = Math.max(...data.ys) + 1.8;
  const mx = x => pad + (x - x0) / (x1 - x0) * (W - 2 * pad);
  const my = y => H - pad - (y - yLo) / (yHi - yLo) * (H - 2 * pad);

  g.clearRect(0, 0, W, H);

  // 坐标轴
  g.strokeStyle = '#2a2e3e'; g.lineWidth = 1;
  g.beginPath();
  g.moveTo(mx(x0), my(0)); g.lineTo(mx(x1), my(0));
  g.moveTo(mx(0), my(yLo)); g.lineTo(mx(0), my(yHi));
  g.stroke();

  // 最优直线(绿色虚线)——它对应 3D 里的绿色垂足
  g.strokeStyle = 'rgba(81,207,102,.85)'; g.lineWidth = 1.5;
  g.setLineDash([4, 3]);
  g.beginPath();
  g.moveTo(mx(x0), my(data.kStar * x0 + data.bStar));
  g.lineTo(mx(x1), my(data.kStar * x1 + data.bStar));
  g.stroke();
  g.setLineDash([]);

  // 残差竖线(灰)——每一根的平方加起来就是 3D 里残差线段长度的平方
  g.strokeStyle = 'rgba(154,160,180,.8)'; g.lineWidth = 1.5;
  for (const [px, py] of data.points) {
    g.beginPath();
    g.moveTo(mx(px), my(py)); g.lineTo(mx(px), my(k * px + b));
    g.stroke();
  }

  // 当前直线(黄色)——它对应 3D 里的黄色预测点 ŷ
  g.strokeStyle = '#ffd43b'; g.lineWidth = 2;
  g.beginPath();
  g.moveTo(mx(x0), my(k * x0 + b)); g.lineTo(mx(x1), my(k * x1 + b));
  g.stroke();

  // 数据点(红)
  g.fillStyle = '#ff6b6b';
  for (const [px, py] of data.points) {
    g.beginPath(); g.arc(mx(px), my(py), 3.5, 0, Math.PI * 2); g.fill();
  }
}

// ---- 面板 ----
function currentK() { return parseFloat(document.getElementById('kSlider').value); }
function currentB() { return parseFloat(document.getElementById('bSlider').value); }
const fmt3 = v => `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`;
const set = (id, txt) => { document.getElementById(id).textContent = txt; };
const setOk = (id, val, tol) => {
  const el = document.getElementById(id);
  el.textContent = val.toFixed(3);
  el.classList.toggle('ok', Math.abs(val) < tol);
};

function updatePanel(k, b, yh, e, t) {
  set('kVal', k.toFixed(2));
  set('bVal', b.toFixed(2));
  set('vY', fmt3(data.yVec));
  set('vX', fmt3(data.xVec));
  set('vOne', fmt3(data.oneVec));
  set('vYhat', fmt3(yh));
  set('vE', fmt3(e));
  set('vSSE', e.magSq().toFixed(3));
  setOk('vDotX', p5.Vector.dot(e, data.xVec), 0.02);
  setOk('vDot1', p5.Vector.dot(e, data.oneVec), 0.02);
  set('perpPct', (t * 100).toFixed(1) + '%');
}
