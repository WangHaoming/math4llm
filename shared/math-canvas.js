// shared/math-canvas.js
// 通用数学可视化画布助手 —— 配合 p5.js「全局模式」使用。
//
// 坐标约定:
//   数学坐标系 y 轴朝上,原点在画布正中心(符合数学直觉)。
//   内部以「数学像素」存储端点:1 个数学单位 = opts.unit 像素。
//
// 用法见 demos/dot-product/sketch.js。

function MathViz(opts = {}) {
  let w = opts.w || opts.size || 560;  // 画布宽(像素;不传 w/h 则沿用 size 正方形)
  let h = opts.h || opts.size || 560;  // 画布高(像素)
  const unit = opts.unit || 40;        // 1 个数学单位 = 多少像素
  const snap = opts.snap || unit / 2;  // 拖拽吸附步长

  const handles = {};                  // 可拖拽端点:name -> { pos, col }
  let dragging = null;

  const api = {
    unit,
    get w() { return w; },
    get h() { return h; },

    // 画布尺寸变化时调用;端点以数学像素相对原点存储,原点始终居中,位置自动保持
    resize(nw, nh) { w = nw; h = nh; },

    // ---- 坐标变换 ----
    // 数学像素(y 向上,原点中心) -> 屏幕像素(y 向下,原点左上)
    toScreen(v) { return createVector(w / 2 + v.x, h / 2 - v.y); },
    // 屏幕像素 -> 数学像素
    toLocal(sx, sy) { return createVector(sx - w / 2, -(sy - h / 2)); },
    // 数学像素 -> 数学单位 (x, y)
    toUnits(v) { return createVector(v.x / unit, v.y / unit); },
    // 数学单位 -> 数学像素
    fromUnits(x, y) { return createVector(x * unit, y * unit); },

    // ---- 绘制基元 ----
    drawGrid() {
      push();
      stroke(40, 44, 60); strokeWeight(1);
      for (let x = (w / 2) % unit; x < w; x += unit) line(x, 0, x, h);
      for (let y = (h / 2) % unit; y < h; y += unit) line(0, y, w, y);
      stroke(90, 96, 120); strokeWeight(1.5);
      line(0, h / 2, w, h / 2);   // x 轴
      line(w / 2, 0, w / 2, h);   // y 轴
      pop();
    },

    arrow(from, to, col, w = 3) {
      const s = this.toScreen(from), e = this.toScreen(to);
      push();
      stroke(col); strokeWeight(w); fill(col);
      line(s.x, s.y, e.x, e.y);
      const ang = atan2(e.y - s.y, e.x - s.x);
      translate(e.x, e.y); rotate(ang);
      noStroke(); triangle(0, 0, -12, 5, -12, -5);
      pop();
    },

    // 坐标轴刻度数字:每 1 个数学单位一个,x 轴标在轴下方、y 轴标在轴左侧,
    // 0 只在原点标一次;贴近画布边缘的刻度不画,避免被裁掉一半
    drawTicks(col) {
      push();
      noStroke(); fill(col || color(154, 160, 180)); textSize(10);
      const maxX = Math.ceil(w / 2 / unit), maxY = Math.ceil(h / 2 / unit);
      textAlign(CENTER, TOP);
      for (let i = -maxX; i <= maxX; i++) {
        if (i === 0) continue;
        const s = this.toScreen(createVector(i * unit, 0));
        if (s.x < 10 || s.x > w - 10) continue;
        text(i, s.x, h / 2 + 5);
      }
      textAlign(RIGHT, CENTER);
      for (let j = -maxY; j <= maxY; j++) {
        if (j === 0) continue;
        const s = this.toScreen(createVector(0, j * unit));
        if (s.y < 10 || s.y > h - 10) continue;
        text(j, w / 2 - 5, s.y);
      }
      textAlign(RIGHT, TOP);
      text('0', w / 2 - 5, h / 2 + 5);
      pop();
    },

    // 在数学像素位置 v 处画文字标注;dx/dy 为屏幕像素偏移(y 向下)
    label(v, txt, col, dx = 0, dy = 0, sz = 13) {
      const s = this.toScreen(v);
      push(); noStroke(); fill(col); textSize(sz); textAlign(CENTER, CENTER);
      text(txt, s.x + dx, s.y + dy);
      pop();
    },

    dashedLine(from, to, col, alpha = 80) {
      const s = this.toScreen(from), e = this.toScreen(to);
      push();
      drawingContext.setLineDash([6, 6]);
      stroke(red(col), green(col), blue(col), alpha); strokeWeight(1.5);
      line(s.x, s.y, e.x, e.y);
      drawingContext.setLineDash([]);
      pop();
    },

    // ---- 可拖拽端点 ----
    // 注册端点,初始位置以「数学单位」给出;返回其数学像素向量。
    addHandle(name, ix, iy, col) {
      handles[name] = { pos: this.fromUnits(ix, iy), col };
      return handles[name].pos;
    },
    handle(name) { return handles[name].pos; },   // 数学像素
    units(name) { return this.toUnits(handles[name].pos); }, // 数学单位 (x,y)
    removeHandle(name) { if (dragging === name) dragging = null; delete handles[name]; },
    isDragging() { return dragging !== null; },   // 本次按下是否抓中了某个端点

    drawHandles() {
      for (const k in handles) {
        const s = this.toScreen(handles[k].pos);
        push(); noStroke();
        fill(handles[k].col); circle(s.x, s.y, 14);
        fill(255, 255, 255, 200); circle(s.x, s.y, 5);
        pop();
      }
    },

    // 在 p5 的 mousePressed / mouseDragged / mouseReleased 里转发调用
    onPressed() {
      const m = createVector(mouseX, mouseY);
      for (const k in handles) {
        if (p5.Vector.dist(m, this.toScreen(handles[k].pos)) < 16) { dragging = k; return; }
      }
    },
    onDragged() {
      if (!dragging) return;
      const local = this.toLocal(mouseX, mouseY);
      local.x = Math.round(local.x / snap) * snap;
      local.y = Math.round(local.y / snap) * snap;
      handles[dragging].pos = local;
    },
    onReleased() { dragging = null; },
  };
  return api;
}
