# 数学可视化合集 (math4llm)

用交互式图像理解各种数学概念。每个概念是一个独立的小 demo,拖一拖、调一调,看公式背后的几何意义。

技术栈:**p5.js**(画布/动画/交互) + **KaTeX**(公式) + 一个轻量公共层。无构建步骤。

## 运行

直接双击 `index.html` 即可打开(纯静态,CDN 引入第三方库)。

若浏览器对本地文件有限制,在项目根目录起个静态服务器:

```bash
python3 -m http.server 8000
# 然后访问 http://localhost:8000
```

## 目录结构

```
math4llm/
├── index.html              # 首页:所有 demo 的导航
├── shared/                 # 公共层(所有 demo 复用)
│   ├── style.css           # 全局样式
│   ├── math-canvas.js      # MathViz:网格/坐标轴/坐标变换/箭头/可拖拽端点
│   └── katex-setup.js      # KatexSetup():渲染页面里的 LaTeX
└── demos/
    └── dot-product/        # 向量加法 · 点积
        ├── index.html
        ├── sketch.js
        └── README.md       # 该 demo 的用法 + 数学概念的几何/物理意义
```

> 约定:**每个 demo 目录都必须有自己的 `README.md`**,说明如何使用,并详细讲解该 demo 所演示概念的几何意义或物理意义。

## 加一个新 demo

1. 在 `demos/` 下新建文件夹,如 `demos/least-squares/`。
2. 复制 `demos/dot-product/index.html` 作模板,改标题与面板内容。
3. 写 `sketch.js`,用公共层 `MathViz` 起步:

   ```js
   let viz;
   function setup() {
     const c = createCanvas(560, 560); c.parent('canvas-holder');
     viz = MathViz({ size: 560, unit: 40 });
     viz.addHandle('p', 2, 1, color(255, 107, 107)); // 可拖端点(数学单位)
     KatexSetup();
   }
   function draw() {
     background(15, 17, 23);
     viz.drawGrid();
     viz.arrow(createVector(0, 0), viz.handle('p'), color(255, 107, 107));
     viz.drawHandles();
   }
   function mousePressed()  { viz.onPressed(); }
   function mouseDragged()  { viz.onDragged(); }
   function mouseReleased() { viz.onReleased(); }
   ```

4. 写 `README.md`,说明用法并讲解该概念的几何/物理意义(参考 `demos/dot-product/README.md`)。
5. 在首页 `index.html` 把对应卡片从 `class="card soon"` 改成 `class="card" href="..."`。

### MathViz API 速查

| 方法 | 作用 |
|------|------|
| `MathViz({size, unit, snap})` | 创建画布助手;`unit` = 1 数学单位的像素数 |
| `drawGrid()` | 画网格与坐标轴 |
| `arrow(from, to, col, w)` | 画带箭头的向量(参数为数学像素向量) |
| `dashedLine(from, to, col, alpha)` | 虚线 |
| `addHandle(name, x, y, col)` | 注册可拖端点,初始位置用数学单位 |
| `handle(name)` / `units(name)` | 取端点的数学像素 / 数学单位坐标 |
| `drawHandles()` | 画所有端点 |
| `onPressed/onDragged/onReleased()` | 在 p5 鼠标事件里转发 |

坐标约定:数学坐标 y 轴朝上,原点在画布中心。
