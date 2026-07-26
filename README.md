# 数学可视化合集 (math4llm)

用交互式图像理解数学与机器学习里的核心概念。每个概念是一个独立的小 demo,
拖一拖、调一调,看公式背后的几何意义——而不是把公式背下来。

**在线体验:** <https://wanghaoming.github.io/math4llm/>

## demo 一览

首页 [`index.html`](index.html) 是所有 demo 的导航。当前已上线四个:

| demo | 领域 | 一句话 |
|------|------|--------|
| [什么是神经网络](demos/what-is-nn/) | 神经网络 | 在浏览器里现场训练一个迷你网络识别手写数字,亲眼看它从瞎猜到学会。 |
| [向量加法 · 点积](demos/dot-product/) | 线性代数 | 拖动两个向量,实时看加法、夹角,以及点积的几何意义——投影。 |
| [最小二乘 vs 最小绝对偏差](demos/least-squares/) | 回归 | 拖散点、调直线,同屏对比平方误差(L2)与绝对值误差(L1),看离群点如何拽走 L2 却拽不动 L1。 |
| [正交投影 · 最小二乘的几何本质](demos/orthogonal-projection/) | 线性代数 | 三维场景里拖 k、b:预测点在模型平面上滑动,残差随「垂直程度」由灰变绿——最小二乘解就是垂足。 |

> **规划中:** 微分 · 导数(割线逼近切线,看导数作为瞬时变化率的含义)。

这几个 demo 不是彼此孤立的,而是一条循序渐进的线索:**点积**埋下「投影」的
伏笔,**最小二乘**回收它(最优解就是一次投影),**正交投影**把「投影」讲到
几何本质,最后**神经网络**里最重要的那次运算又正是点积。建议按上表顺序体验。

每个 demo 目录下都有自己的 `README.md`,详细讲解它所演示概念的几何 / 物理意义
——那才是本项目的核心价值,画面只是入口。

## 运行

纯静态、无构建步骤。直接双击根目录的 `index.html` 即可打开。

若浏览器对本地文件(`file://`)有跨源限制,在项目根目录起一个静态服务器:

```bash
python3 -m http.server 8000
# 然后访问 http://localhost:8000
```

## 技术栈

- **p5.js** —— 画布、动画、交互(用「全局模式」)。
- **KaTeX** —— 渲染数学公式。
- 第三方库全部走 CDN,**没有打包器、没有构建步骤**。

不是每个 demo 都长一个样,渲染方式按需要而定:

| demo | 渲染方式 |
|------|----------|
| dot-product、least-squares | p5.js 2D + 公共层 `MathViz` |
| orthogonal-projection | p5.js **WEBGL**(三维场景,自带专属绘制,不走 MathViz) |
| what-is-nn | 纯原生 `<canvas>` + 少量 JS,自成一页(不依赖 p5 / KaTeX) |

新增二维图形类 demo 时,优先复用公共层;只有确实需要三维或整页叙事时,才像
后两个 demo 那样另起炉灶。

## 目录结构

```
math4llm/
├── index.html              # 首页:所有 demo 的导航卡片
├── README.md               # 本文件:面向开发者的项目说明
├── CLAUDE.md / AGENTS.md   # 给 AI 助手的项目约定
├── shared/                 # 公共层,二维 demo 复用
│   ├── style.css           # 全局样式(首页卡片 + demo 面板)
│   ├── math-canvas.js      # MathViz:网格 / 坐标轴 / 坐标变换 / 箭头 / 可拖拽端点
│   └── katex-setup.js      # KatexSetup():渲染页面里的 LaTeX
└── demos/<demo-name>/
    ├── index.html
    ├── sketch.js           # (WEBGL / 原生 canvas 的 demo 结构可不同)
    └── README.md           # 该 demo 的用法 + 概念的几何 / 物理意义
```

> **约定:** 每个 demo 目录**必须且只有一个** `README.md`,既说明如何交互,又
> 详细讲透所演示概念的几何 / 物理意义,不另建平行讲解文档。

## 加一个新 demo

以最常见的二维图形 demo 为例:

1. 在 `demos/` 下新建文件夹,如 `demos/derivative/`,复制
   [`demos/dot-product/`](demos/dot-product/) 作模板。
2. 改 `index.html` 的标题与面板内容。
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

4. 写 `README.md`,说明用法并讲透该概念的几何 / 物理意义(参考
   [`demos/dot-product/README.md`](demos/dot-product/README.md))。
5. 在首页 [`index.html`](index.html) 把对应卡片从 `class="card soon"`(占位)
   改成 `class="card" href="demos/<name>/index.html"`(激活)。

需要三维场景或整页长文时,不必套 `MathViz`——参考
[`demos/orthogonal-projection/`](demos/orthogonal-projection/)(WEBGL)与
[`demos/what-is-nn/`](demos/what-is-nn/)(原生 canvas)。

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
| `onPressed / onDragged / onReleased()` | 在 p5 鼠标事件里转发 |

**坐标约定:** 数学坐标系 y 轴朝上,原点在画布中心。
