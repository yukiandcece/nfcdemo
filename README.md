# NFC UID Demo

一个尽可能简单的前端 NFC 刷卡示例，目标是在手机浏览器里读取 NFC 标签的唯一标识 `serialNumber`，并顺手展示 NDEF 记录内容。

这个仓库也是一个可复制的 Web NFC demo：核心读写能力已经封装在 `nfc-core.js`，其它项目可以直接复制该文件接入。详细用法见 [NFC_CORE_GUIDE.md](./NFC_CORE_GUIDE.md)。

## 适用场景

- 安卓手机
- Chrome 浏览器
- 页面通过 HTTPS 打开

不适用：

- iPhone Safari
- 纯 HTTP 页面
- 非 NDEF 标签的完整解析

## 本地文件

- `index.html`：页面结构
- `nfc-core.js`：可复制到其它项目的 Web NFC 读写核心模块
- `app.js`：demo 页面交互逻辑
- `style.css`：移动端样式

## 如何运行

最简单的方式是把当前目录部署到任意静态 HTTPS 托管：

- GitHub Pages
- Netlify
- Vercel

然后用安卓手机 Chrome 打开页面，点击“开始扫描 NFC”或“写入”，把卡贴近手机背面即可。

当前 GitHub Pages 地址：

```text
https://yukiandcece.github.io/nfcdemo/
```

### 本地启动

当前项目也可以直接在 Windows PowerShell 里本地启动：

```powershell
./start-local.ps1
```

停止：

```powershell
./stop-local.ps1
```

本机浏览器访问：

- http://127.0.0.1:8080
- http://localhost:8080

如果同一局域网手机访问你的电脑，一般会是：

- http://你的电脑局域网IP:8080

但要注意，`http://局域网IP:8080` 不是安全上下文，手机浏览器通常无法使用 Web NFC。真正要在手机上测 NFC，推荐部署到 HTTPS，或者改成原生 Android。

## 重要限制

1. Web NFC 只在部分浏览器可用，现实中主要就是 Android Chrome。
2. `serialNumber` 可能是空字符串，这取决于浏览器和标签是否暴露该信息。
3. Web NFC 主要面向 NDEF 标签；某些门禁卡、IC 卡、CPU 卡未必能直接被网页读取。
4. 系统浏览器、应用内置浏览器经常会直接拒绝 `scan()`，即使页面本身能正常打开。
5. 写入功能只适用于可写、未锁定且容量足够的 NDEF 标签。
6. 本 demo 写入的是 JSON MIME 记录，格式为 `{ "nfc_id": "..." }`。旧版本写入的 text 记录需要重新写卡才会变成 JSON。

## 排查建议

1. 页面右上角先确认版本号是否为最新。
2. 必须用 Android Chrome 直接打开，不要用微信、QQ、钉钉或系统内置浏览器。
3. 如果页面里“浏览器判断”不是 `Android Chrome`，先不要继续测 NFC。
4. 如果权限状态是“已拒绝”，去 Chrome 的站点设置里重置该站点权限后再试。

## 现成参考

- Chrome 官方说明：https://developer.chrome.com/docs/capabilities/nfc
- MDN `serialNumber` 文档：https://developer.mozilla.org/en-US/docs/Web/API/NDEFReadingEvent/serialNumber
- GoogleChrome 示例仓库：https://github.com/GoogleChrome/samples
- Web NFC 规范仓库：https://github.com/w3c/web-nfc

## 建议

如果你的目标是“门禁卡 UID 必须稳定可读，而且希望兼容更多机型”，那就不要继续走纯前端网页路线，改成原生 Android 或 Capacitor 插件会更稳。
