# NFC 核心功能接入指南

这个 demo 已经把读写 NFC 的核心逻辑封装在 `nfc-core.js`。其它项目可以直接复制这个文件使用，页面 UI、按钮、弹窗和状态提示都不在核心模块里。

## 复制文件

把下面这个文件复制到你的项目：

```text
nfc-core.js
```

如果你的项目使用构建工具，可以按 ES Module 方式导入；如果是普通静态页面，也可以用 `<script type="module">`。

```html
<script type="module" src="./your-page.js"></script>
```

## 核心能力

`nfc-core.js` 提供这些常用方法：

- `isWebNfcSupported()`：判断当前浏览器是否暴露 Web NFC API。
- `detectNfcBrowser()`：判断当前环境是否看起来像 Android Chrome。
- `collectNfcDiagnostics()`：收集浏览器、权限、安全上下文、页面可见性等诊断信息。
- `createNfcScanner()`：创建读取器，持续读取 NDEF 标签。
- `writeNfcId(nfcId)`：写入 `{ "nfc_id": "..." }` JSON 数据。
- `writeNfcJson(payload)`：写入任意 JSON 对象。
- `parseNdefRecord()` / `parseNdefMessage()`：把原始 NDEF 记录解析成普通 JSON。
- `explainNfcScanError()` / `explainNfcWriteError()`：把常见异常转成中文提示。

## 读取示例

```js
import {
  createNfcScanner,
  explainNfcScanError,
  collectNfcDiagnostics,
} from "./nfc-core.js";

let scanner = null;

async function startRead() {
  try {
    scanner = createNfcScanner({
      onReading: (result) => {
        console.log("serialNumber:", result.serialNumber);
        console.log("records:", result.records);
      },
      onReadingError: () => {
        console.log("检测到 NFC 标签，但无法按 NDEF 读取");
      },
    });

    await scanner.start();
    console.log("开始扫描，请贴近 NFC 标签");
  } catch (error) {
    const diagnostics = await collectNfcDiagnostics();
    console.log(explainNfcScanError(error, diagnostics));
  }
}

function stopRead() {
  scanner?.stop();
  scanner = null;
}
```

读取新版写入的卡片时，结果通常类似：

```json
[
  {
    "recordType": "mime",
    "mediaType": "application/json",
    "id": "",
    "byteLength": 31,
    "rawHex": "...",
    "nfc_id": "40999_18282867316"
  }
]
```

## 写入示例

```js
import {
  writeNfcId,
  explainNfcWriteError,
  collectNfcDiagnostics,
} from "./nfc-core.js";

async function writeCard(nfcId) {
  try {
    await writeNfcId(nfcId);
    console.log("写入成功");
  } catch (error) {
    const diagnostics = await collectNfcDiagnostics();
    console.log(explainNfcWriteError(error, diagnostics));
  }
}
```

`writeNfcId("40999_18282867316")` 写入的是 JSON MIME 记录：

```json
{
  "nfc_id": "40999_18282867316"
}
```

如果你想写入更多字段，可以用 `writeNfcJson()`：

```js
import { writeNfcJson } from "./nfc-core.js";

await writeNfcJson({
  nfc_id: "40999_18282867316",
  source: "web",
});
```

## 接入建议

1. 读和写都必须由用户点击触发，比如点击“开始扫描”或“写入”按钮。
2. 写入前尽量不要做太多异步操作，避免浏览器认为这次 NFC 操作不是用户手势触发。
3. 不要同时读和写。正在扫描时如果要写入，先调用 `scanner.stop()`。
4. 读取流程可以持续运行；写入流程一般是一次性操作，写完就结束。
5. 如果要让手机访问，推荐部署到 HTTPS，例如 GitHub Pages、Vercel、Netlify。

## 重要限制

1. Web NFC 现实中主要支持 Android Chrome。iPhone Safari、微信内置浏览器、QQ 内置浏览器、很多国产系统浏览器通常不可用。
2. 页面必须是安全上下文。HTTPS 可以；`http://localhost` 通常可以；局域网 HTTP 地址通常不可以。
3. Web NFC 主要处理 NDEF 标签。门禁卡、饭卡、CPU 卡、MIFARE Classic 等不一定能被网页读取或写入。
4. `serialNumber` 不保证稳定可用，浏览器或标签可能返回空字符串。
5. 写入只适用于可写、未锁定且容量足够的 NDEF 标签。
6. 旧卡片里已经写入的 `recordType: "text"` 内容不会自动变成 JSON，需要用新版页面重新写入覆盖。
7. 浏览器权限被拒绝后，需要到 Chrome 的站点设置里重置 NFC 权限。
8. 页面切到后台、被 iframe 嵌入、屏幕锁定、系统 NFC 关闭，都可能导致读写失败。
9. Web NFC 不适合做高兼容性的门禁卡 UID 读取。如果必须稳定读取实体卡 UID，建议使用原生 Android 或 Capacitor/Cordova 原生 NFC 插件。

## 当前 demo 地址

```text
https://yukiandcece.github.io/nfcdemo/
```
