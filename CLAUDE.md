# CLAUDE.md

本文件供 Claude Code 每次执行任务时读取,记录本项目的目标与约定。

## 项目目标

**math4llm** 是一个数学可视化合集:用交互式图形界面帮助理解各种数学概念。
每个数学概念是一个独立的小 demo,用户通过拖动、调参等交互,直观看到公式背后的
几何意义或物理意义。

已规划/进行中的 demo:
- ✅ 向量加法 · 点积(`demos/dot-product/`)
- ⏳ 最小二乘法
- ⏳ 微分 · 导数
- (后续持续增加)

## 技术栈与运行方式

- **p5.js**:画布、动画、交互(用「全局模式」)。
- **KaTeX**:渲染数学公式。
- 第三方库走 CDN;**无构建步骤**,双击 `index.html` 即可运行。
- 需本地服务器时:`python3 -m http.server 8000`。
- 不要引入打包器 / ES module / 框架,除非项目明显需要且用户同意。

## 目录结构

```
math4llm/
├── index.html              # 首页:所有 demo 的导航卡片
├── README.md               # 面向开发者的项目说明
├── CLAUDE.md               # 本文件
├── shared/                 # 公共层,所有 demo 复用
│   ├── style.css           # 全局样式(首页卡片 + demo 面板)
│   ├── math-canvas.js      # MathViz:网格/坐标轴/坐标变换/箭头/可拖拽端点
│   └── katex-setup.js      # KatexSetup():渲染页面 LaTeX
└── demos/<demo-name>/
    ├── index.html
    ├── sketch.js
    └── README.md
```

## 硬性约定(每次新建/修改 demo 都要遵守)

1. **每个 demo 目录必须有自己的 `README.md`,且只能有这一个说明(讲解)文档**
   ——不要另建 `basic.md` 等平行文档,讲解一律并入 `README.md`。内容包含:
   - 该 demo **如何使用**(怎么交互、各开关/控件的作用)。
   - **详细讲解该 demo 所演示数学概念的几何意义或物理意义**(这是本项目核心价值,
     务必讲透,可配合"试试这几种情形"引导用户观察)。
2. 通用绘图能力(网格、坐标轴、坐标变换、箭头、可拖拽端点)一律复用 `shared/math-canvas.js`
   里的 `MathViz`,不要在各 demo 里重复实现。新增的通用能力应加进公共层。
3. 坐标约定:数学坐标系 **y 轴朝上,原点在画布中心**。
4. 新增 demo 后,在首页 `index.html` 把对应卡片从 `class="card soon"`(占位)
   改为 `class="card" href="demos/<name>/index.html"`(激活)。
5. 配色、面板布局沿用 `shared/style.css` 既有风格,保持各 demo 视觉一致。
6. 代码注释用中文,风格与现有文件保持一致。

## 添加新 demo 的步骤

1. 新建 `demos/<name>/`,复制 `demos/dot-product/` 作为模板。
2. 改 `index.html` 标题与面板,写 `sketch.js`(基于 `MathViz`)。
3. 写 `README.md`(用法 + 几何/物理意义)。
4. 在首页激活对应卡片。

参考实现:`demos/dot-product/`(代码 + README 都可作为范例)。
