// shared/katex-setup.js
// 渲染页面里的 LaTeX 公式。支持 $...$(行内)与 $$...$$(独立公式)。
// 在 setup() 末尾调用一次即可:KatexSetup();

function KatexSetup(target) {
  const run = () => window.renderMathInElement(target || document.body, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$',  right: '$',  display: false },
    ],
    throwOnError: false,
  });
  if (window.renderMathInElement) run();
  else window.addEventListener('load', run);
}
