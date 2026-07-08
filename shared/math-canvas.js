// shared/math-canvas.js
// 通用数学可视化画布助手 —— 配合 p5.js「全局模式」使用。
//
// 坐标约定:
//   数学坐标系 y 轴朝上,原点在画布正中心(符合数学直觉)。
//   内部以「数学像素」存储端点:1 个数学单位 = opts.unit 像素。
//
// 用法见 demos/dot-product/sketch.js。

function MathViz(opts = {}) {
  const size = opts.size || 560;       // 画布边长(像素)
  const unit = opts.unit || 40;        // 1 个数学单位 = 多少像素
  const snap = opts.snap || unit / 2;  // 拖拽吸附步长

  const handles = {};                  // 可拖拽端点:name -> { pos, col }
  let dragging = null;

  const api = {
    size, unit,

    // ---- 坐标变换 ----
    // 数学像素(y 向上,原点中心) -> 屏幕像素(y 向下,原点左上)
    toScreen(v) { return createVector(size / 2 + v.x, size / 2 - v.y); },
    // 屏幕像素 -> 数学像素
    toLocal(sx, sy) { return createVector(sx - size / 2, -(sy - size / 2)); },
    // 数学像素 -> 数学单位 (x, y)
    toUnits(v) { return createVector(v.x / unit, v.y / unit); },
    // 数学单位 -> 数学像素
    fromUnits(x, y) { return createVector(x * unit, y * unit); },

    // ---- 绘制基元 ----
    drawGrid() {
      push();
      stroke(40, 44, 60); strokeWeight(1);
      for (let x = (size / 2) % unit; x < size; x += unit) line(x, 0, x, size);
      for (let y = (size / 2) % unit; y < size; y += unit) line(0, y, size, y);
      stroke(90, 96, 120); strokeWeight(1.5);
      line(0, size / 2, size, size / 2);   // x 轴
      line(size / 2, 0, size / 2, size);   // y 轴
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
