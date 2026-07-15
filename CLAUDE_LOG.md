# Claude Code 工作日志

## 2026-07-11

### 初始理解
- 用户要求阅读 `demos/dot-product/` 目录,并在其 `README.md` 中:
  1. 详细讲解点积的计算原理与几何意义。
  2. 结合 `index.html` 的 demo(拖动 a、b 两向量,显示投影/夹角/平行四边形)讲解。
  3. 重点讲清「为什么点积对神经网络的实现最重要」。

### 变更计划
- 仅修改 `demos/dot-product/README.md`,不动代码(demo 功能已满足讲解需要)。
- 强化「计算原理」:代数定义与几何定义为何等价(投影 / 余弦定理)。
- 结合 demo 各控件(投影黄色箭头、夹角、平行四边形)落地几何意义。
- 新增一节「为什么点积对神经网络最重要」:神经元 = 加权求和 = 点积;
  相似度 / 注意力;矩阵乘法本质是大量点积;GPU 并行。

### 总结
- 已重写 `demos/dot-product/README.md`,新增三大板块:
  一、计算原理(用余弦定理证明代数=几何两定义等价,并给出由点积反解长度/夹角/投影)。
  二、几何意义(在原有基础上补充点积的对称性与三因素:方向一致度 + 两者长度)。
  三、为什么点积对神经网络最重要(神经元=点积、点积=相似度打分、层=矩阵乘法=一批点积、
      硬件 MAC/GPU 并行、反向传播复用)。
- 全程结合 demo 控件(黄色投影箭头、夹角、平行四边形、面板各行)讲解。
- 仅改动文档,未改代码;未运行测试(纯文档变更,无需)。

---

## 2026-07-14 · what-is-nn:增加 USE_RELU 开关

**初始理解**:用户想做消融实验——看关闭 ReLU 后识别准确率的变化。训练与推理共用
`demos/what-is-nn/index.html` 里的 `forward()`;ReLU 出现在两处:前向的截断
(`z > 0 ? z : 0`)和反向的梯度掩码(`h <= 0` 时跳过)。不上 UI,用 const 控制。

**改动计划**:
1. 模型段顶部加 `const USE_RELU = true;`,注释说明改 false 即可做无激活函数对照实验。
2. 前向:`USE_RELU=false` 时隐藏层直接输出线性值 z。
3. 反向:掩码条件加上 `USE_RELU &&`——线性模式下负激活也要传梯度,否则反向就错了。

**总结**:在 `demos/what-is-nn/index.html` 加了 `const USE_RELU = true`(第 397 行附近),
前向截断与反向掩码均受其控制;`forward()` 为训练/推理共用,故一处开关两边生效。
未运行自动化测试(纯前端 demo,需浏览器里手动训练验证)。已知小瑕疵:线性模式下
隐藏层热力图对负激活显示为空白,仅影响可视化,不影响准确率。

---

## 2026-07-15 · dot-product:新增讲解长文 basic.md

**初始理解**:用户要一篇解释点积的文章,要求从 cos 的几何意义讲起,重点讲点积在
神经网络中的几何意义,并加入图解。现有 README.md 有两个缺口:cos 被空降、NN 节
讲工程不讲几何。已与用户确认结构。

**改动计划**:
1. 新建 `demos/dot-product/basic.md`,风格对齐 `what-is-nn/basic.md`
   (中文长文、〇一二三分节、引用块放关键结论、ASCII 字符画做图解)。
2. 叙事线:cos = 方向一致度的尺子 → 点积 = 影子×长度(保留余弦定理证明)
   → 神经元的几何(w 是方向、激活是投影、超平面、ReLU)→ 高维(embedding/注意力)
   → 回到 demo。
3. README.md 顶部加一行指向 basic.md 的链接。

**设计决策**:图解用 ASCII 字符画而非 SVG/图片——与 what-is-nn/basic.md 先例一致,
且纯文本在任何 markdown 查看器里都能显示,符合项目"无构建"约定。

**总结**:新建 `demos/dot-product/basic.md`(约 300 行长文,含 6 幅 ASCII 图解:
单位圆影子、cos 尺子、投影、符号表、决策边界/超平面等);README.md 顶部加了指向
basic.md 的链接。未运行测试(纯 markdown 文档,无可执行代码)。

---

## 2026-07-15 · dot-product:basic.md 合并进 README.md

**初始理解**:用户定下约定——每个 demo 只能有一个 README.md 说明(讲解)文档。
需删除昨天新建的 dot-product/basic.md,内容并入 README.md。

**改动与总结**:
1. 重写 `demos/dot-product/README.md`:保留「如何使用」;原「向量加法」一节
   作为热身(第一节)插入长文叙事线;其余讲解整体替换为长文内容(cos 尺子 →
   影子×长度 → 神经元几何 → 高维),重编章节号并修正内部交叉引用;
   原 README 的工程向内容(GPU/MAC)压缩为一句话,「通向最小二乘」并入结尾。
2. 删除 `demos/dot-product/basic.md`。
3. `CLAUDE.md` 硬性约定第 1 条补充"只能有一个说明文档"。
注:`demos/what-is-nn/basic.md` 同样违反新约定(且被其 index.html 注释引用),
待用户确认后另行处理。未运行测试(纯文档改动)。

---

## 2026-07-15 · dot-product README:第三节重构(计算规则前置 + sinθ 证明)

**初始理解**:用户要求①先讲点积计算规则再讲几何意义;②不用余弦定理,改用
"把坐标轴转到与 b 对齐,a 拆成 (|a|cosθ, |a|sinθ),代入乘加规则直接算"的证明。

**改动与总结**:第三节重排为 3.1 计算规则(含数值例子)→ 3.2 几何意义(影子×长度,
改为"声明"口吻)→ 3.3 新证明(转地面 + sinθ 项乘零点题"点积无视垂直成分",
旁注用差角公式说明乘加的旋转不变性)→ 3.4 符号速查表。已验证:全文无"余弦定理"
残留,小节编号连续,交叉引用成立。保留了用户手动加的第一节 Transformer 注记与
2.1 措辞。未运行测试(纯文档改动)。

---

## 2026-07-15 · dot-product README:公式改为标准 LaTeX 写法

**初始理解**:用户指出 3.1 的公式用 Unicode 下标拼凑(aₓ 与 a_y 混杂)不规范,
要求用标准公式。

**改动与总结**:全文独立成行的公式统一改为 `$$...$$` LaTeX 显示公式(GitHub /
主流 markdown 预览可渲染),关键结论引用块内改用 `$...$` 行内公式;3.1 顺带补了
n 维求和式 Σaᵢbᵢ。ASCII 图解内的标注保持字符画。已验证无 Unicode 下标残留。
未运行测试(纯文档改动)。

---

## 2026-07-15 · dot-product:README 补 sinθ 说明 + demo 新增「证明演示」

**初始理解**:用户要求①README 里补充 sinθ 的说明,为 3.3 的坐标拆分证明铺垫;
②demo 中实现证明的图像演示:任意两个向量,夹角固定,把 b 转到 x 轴上,
在坐标系上标注各步计算(a·b = p×|b| = |a||b|cosθ)。

**改动计划**:
1. `shared/math-canvas.js`:新增通用 `label()`(在数学坐标处画文字标注)——
   按约定通用绘图能力进公共层。
2. `demos/dot-product/sketch.js`:新增证明演示模式。勾选后整个图形刚性旋转
   −β(β 为 b 的方位角),动画平滑过渡;b 躺平后标注影子 |a|cosθ(黄)、
   举高 |a|sinθ(白虚线)、b=(|b|,0)、θ 圆弧;原始 a、b 淡显留作参照,
   仍可拖动;演示期间隐藏平行四边形/投影图层避免混乱。
3. `demos/dot-product/index.html`:加「证明演示」开关与步骤面板
   (躺平后 b、此时 a、乘加算式、结果 = 转轴前的 a·b,强调旋转不变)。
4. README:2.1 图解标注 sinθ 并补"一横一竖两个成分 + 勾股"一段;
   「如何使用」加第三个开关;3.3 加指向演示开关的引导。

**总结**:
- `shared/math-canvas.js` 新增通用 `label()`;`sketch.js` 新增证明演示
  (刚性旋转动画 + 影子/举高/θ 圆弧/坐标标注 + 步骤面板,面板数值按目标坐标
  计算保证动画中稳定);`index.html` 加开关与 proof-box;README 补 sinθ
  一段(勾股 + 横竖分解)并更新用法与 3.3 引导。
- **已用真实 Chrome 验证**(puppeteer-core 驱动 headless Chrome +
  python http.server):勾选后动画完成,b=(2.24,0)、a=(0.45,3.13)、
  乘加 0.45×2.24+3.13×0 = 1.00,与转轴前点积一致;取消勾选正常转回;
  截图确认渲染无误。修了一处截图发现的标签重叠(影子与 b 的标注分行错开)。
- 控制台唯一 404 为 /favicon.ico(项目本来就没有 favicon,与本次改动无关)。

---

## 2026-07-15 · 证明演示:b 的画布标注改为符号形式

**改动与总结**:`demos/dot-product/sketch.js` 里 b 躺平后的画布标注由具体数值
`b = (2.24, 0)` 改为符号形式 `b = (|b|, 0)`,与 a 的符号标注及 README 3.3
证明步骤一一对应;具体数值仍在面板「躺平后 b」显示。影子/举高标签保持
「符号 = 数值」形式(对应面板乘加算式的两个乘数)。已用 headless Chrome
重新验证:截图确认新标注渲染正确、无重叠,面板数值不变,控制台除既有
favicon 404 外无报错。

---

## 2026-07-15 · dot-product:全屏布局,画布随窗口伸缩

**初始理解**:用户要求 demo UI 占满整屏,右侧 panel 宽度不变(340px),
左侧坐标系画布随屏幕大小变化。已确认 what-is-nn 不引用 shared 的 .demo
布局,改 shared/style.css 无副作用。

**改动计划**:①style.css:.demo 高 100vh 不换行、.canvas-holder flex:1、
.panel 固定 340px 可内部滚动、加窄屏纵排回退;②math-canvas.js:MathViz
支持 w/h 矩形尺寸(size 向后兼容)与 resize() 方法,toScreen/toLocal/
drawGrid 全部改用 w/h;③sketch.js:按 canvas-holder 实际尺寸建画布,
新增 windowResized() 联动 resizeCanvas + viz.resize。

**总结**:
- `shared/style.css`:.demo 改为 100vh 全屏 flex(stretch、不换行),
  .canvas-holder flex:1 占满剩余空间,.panel 固定 340px、超高内部滚动,
  另加 ≤800px 窄屏纵排回退。
- `shared/math-canvas.js`:MathViz 支持 w/h 矩形尺寸(size 向后兼容)与
  resize() 方法;toScreen/toLocal/drawGrid 全部改用 w/h,原点始终居中。
- `demos/dot-product/sketch.js`:画布按 #canvas-holder 实际尺寸创建;
  用 ResizeObserver 盯容器(首测发现 KaTeX 渲染前后面板宽度变化不触发
  windowResized,导致初始画布 664px < 容器 788px,改 Observer 后修复)。
- **已用 headless Chrome 验证**:1200×800 与 1680×1000 下画布均与容器
  等大、面板恒 340px;动态改视口画布跟随;resize 后证明演示功能正常
  (乘加 = 转轴前点积 1.00);控制台除既有 favicon 404 无报错。
