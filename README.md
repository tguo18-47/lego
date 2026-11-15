# LEGO Piece Finder

一个面向 PC 的全英文 LEGO 零件查询网页，包含 56 条独立记录、内嵌零件图片和场馆柜格导航演示。

## 打开网页

成品入口是项目根目录的 index.html；src/page.html 是打包模板。
直接用浏览器打开 index.html。搜索、颜色／分类／尺寸筛选、详情和导航均可离线使用。
index.html 内嵌全部 CSS、JavaScript、三维库、数据、图片和标签页图标，可以单独复制到其他电脑，
也可以上传到朋友域名对应的静态网站空间。

浏览器标签页使用 favicon.svg 中的积木图标。图标也已内嵌进 HTML；
图标相对于标题的位置由浏览器决定。

## 前端技术

使用原生 HTML、CSS 和 JavaScript，没有 React、Vue 或 Vite。
三维场景使用 Three.js 0.187.0，以经典脚本格式内嵌，打开成品不需要安装任何依赖。
开发和重新打包时使用 Node.js、esbuild 0.28.2 和 Python；依赖版本保存在 package-lock.json。

## 使用导航

- 右侧从固定的 LEGO Navigation Station 开始，点击结果卡片后，镜头约 3 秒内接近柜子并标出目标格。
- View details 查看原有记录；Replay route 重播；Back to station 返回起点并保留搜索。
- 始终使用左侧查询、右侧三维柜子的 PC 双栏布局；较窄窗口保留此布局并可横向滚动。
- Cabinet map / 3D view 可切换柜格图与三维场景。WebGL 不可用或渲染中断时自动显示柜格图。
- 开启系统的减少动态效果偏好后，直接显示目标位置。

## 图片分类与柜格点选

分类使用大图片卡，每行三张。选大类后逐层显示下一层图片，
结果立即更新；可以停在任何一层，也可以点击路径或 All categories 返回。
仅按尺寸区分的末级项交给独立的 Size 控件。分类说明通过图片卡旁的 i 按钮查看，
即使该类计数为 0 也可阅读。原分类编号、说明、参见链接和记录详情均保留。

右侧三维柜格和二维地图的每个格子都可点击。若目标已在当前结果里，保留全部搜索条件；
若目标不在结果里，清空关键词、颜色、类别、尺寸，恢复全部 56 件并定位目标卡片。
右侧点选保持当前视角，左侧立即定位所选卡片。

三维场景内可滚轮缩放、按住鼠标拖动平移。
右下角提供放大、缩小、恢复整柜视角按钮。键盘聚焦场景后，方向键移动，
加／减键缩放，Home 或 0 恢复整柜视角。手动操作停止镜头动画并保留选择，
拖动和多指手势不会变成柜格点选。Replay route 从导航站重播，Back to station 清除选择。

导航是 Demo layout：一个 7 行 × 8 列的柜子，按 A–E 分组，同类按 TG 编号顺序填入。
行号从上向下、列号从左向右。TG002 为第 1 行第 1 列，TG053 为第 3 行第 2 列。
每个 TG 编号占用独立柜格，外观相同也不合并。位置不是现实场馆的实测记录，也没有实时定位。

地址单独保存在 src/locations.json 的 pieceLocations 中，用 TG 编号关联柜号、行号、列号。
搜索和筛选不会重新分配柜格。以后可以更改此配置来对应真实柜子，再重新打包。
打包会拒绝缺失编号、重复柜格、越界坐标及未知 TG 编号。

## 文件布局

- index.html：最终可直接打开的网页。
- favicon.svg：可编辑的标签页积木图标源文件。
- src/：页面模板、样式、查询引擎、交互代码、数据、图片、打包脚本和验收检查。
- src/locations.json：固定柜格地址；src/navigation.js 与 navigation-model.cjs：渲染及位置／路径逻辑。
- docs/superpowers/specs/：用户已批准的导航设计。
- sources/：用户提供的两份 Excel 与零件参考 PDF 的副本。
- preview.jpg：最近一次网页预览。

## 修改后重新打包

在项目根目录执行：

    npm ci
    python3 src/build_index.py
    npm test

npm ci 仅在首次配置开发环境或依赖变化后需要执行；它需要联网。
此后使用 npm run build 或上述 Python 命令打包。成品 index.html 的使用不需要联网。

修改页面、样式、交互、导航、位置配置、查询引擎或 favicon.svg 后，
重新打包会更新根目录 index.html。

数据快照保存在 src/collection.json，清晰图片覆盖表保存在 src/highres/replacements.json。
如需从项目内的 Excel 重新提取记录，先运行 python3 src/extract_data.py，再打包与检查。
修改原 Downloads 中的 Excel 不会自动改变本项目的副本或网页。

测试包括原有 52 项查询断言、279 组双分面组合，以及 56 个地址、分组边界、非法位置和
22,624 个镜头路径采样点。新增检查覆盖 39 个分类节点、375 种视角边界情况、
四种画面比例的整柜可见范围，以及点击、拖动、多指手势和取消事件。
最新浏览器检查记录在 src/picture-browse-qa-report.json。

可选兼容性检查：运行 python3 src/prepare_qa.py 后，通过下面的本地预览访问
src/generated/qa/ 下的五个测试网页，分别模拟无 WebGL、减少动态效果、图片损坏、渲染上下文丢失和触屏手势输入。
这些测试网页不包含在交付入口中，生成目录已加入忽略列表。

可选本地预览：

    python3 -m http.server 8765 --bind 127.0.0.1

然后在浏览器打开 http://127.0.0.1:8765/。

## 迁移位置

本项目位于 /Users/tian/github/lego。
旧 Downloads 网页文件名及原聊天输出入口保留为指向新位置的链接，避免打开过期副本。
Git 仓库保存源码、数据和离线成品；网站部署单独配置。
