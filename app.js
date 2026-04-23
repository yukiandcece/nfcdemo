const APP_VERSION = "2026.04.23-r3";

const scanButton = document.getElementById("scanButton");
const stopButton = document.getElementById("stopButton");
const refreshButton = document.getElementById("refreshButton");
const statusEl = document.getElementById("status");
const serialNumberEl = document.getElementById("serialNumber");
const recordCountEl = document.getElementById("recordCount");
const scanTimeEl = document.getElementById("scanTime");
const scanStateEl = document.getElementById("scanState");
const recordsEl = document.getElementById("records");
const appVersionEl = document.getElementById("appVersion");
const versionHintEl = document.getElementById("versionHint");
const browserStateEl = document.getElementById("browserState");
const supportStateEl = document.getElementById("supportState");
const permissionStateEl = document.getElementById("permissionState");
const contextStateEl = document.getElementById("contextState");
const topLevelStateEl = document.getElementById("topLevelState");
const visibilityStateEl = document.getElementById("visibilityState");
const originStateEl = document.getElementById("originState");
const diagnosticsJsonEl = document.getElementById("diagnosticsJson");

const state = {
  controller: null,
  ndef: null,
  scanning: false,
  lastError: null,
  lastReadAt: null,
  diagnostics: null,
  handlers: null,
};

function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.dataset.type = type;
}

function formatNow() {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function formatBool(value) {
  return value ? "是" : "否";
}

function formatPermission(stateValue) {
  if (stateValue === "granted") {
    return "已允许";
  }

  if (stateValue === "denied") {
    return "已拒绝";
  }

  if (stateValue === "prompt") {
    return "待请求";
  }

  return "未知";
}

function detectBrowser() {
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isChrome = /Chrome\/\d+/i.test(ua);
  const blockedShells = [
    [/EdgA\//i, "Edge Android"],
    [/SamsungBrowser\//i, "Samsung Internet"],
    [/HuaweiBrowser\//i, "Huawei Browser"],
    [/MiuiBrowser\//i, "MIUI Browser"],
    [/XiaoMi\/MiuiBrowser/i, "MIUI Browser"],
    [/MQQBrowser\//i, "QQ Browser"],
    [/QQBrowser\//i, "QQ Browser"],
    [/UCBrowser\//i, "UC Browser"],
    [/OPR\//i, "Opera"],
    [/VivoBrowser\//i, "Vivo Browser"],
    [/HeyTapBrowser\//i, "OPPO Browser"],
    [/MicroMessenger\//i, "WeChat WebView"],
    [/wv\)/i, "Android WebView"],
  ];

  const shell = blockedShells.find(([pattern]) => pattern.test(ua));
  const label = shell
    ? shell[1]
    : isAndroid && isChrome
      ? "Android Chrome"
      : isAndroid
        ? "Android 浏览器"
        : "非 Android 浏览器";

  return {
    label,
    isAndroid,
    isChrome,
    isRecommended: isAndroid && isChrome && !shell,
    userAgent: ua,
  };
}

async function getNfcPermissionState() {
  if (!("permissions" in navigator) || !navigator.permissions.query) {
    return "unknown";
  }

  try {
    const result = await navigator.permissions.query({ name: "nfc" });
    return result.state;
  } catch {
    return "unknown";
  }
}

function bytesToHex(dataView) {
  if (!dataView) {
    return "";
  }

  const bytes = new Uint8Array(
    dataView.buffer,
    dataView.byteOffset,
    dataView.byteLength,
  );

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

function readDataViewAsText(dataView, encoding = "utf-8") {
  const candidates = [encoding, "utf-8", "utf-16le"];

  for (const candidate of candidates) {
    try {
      return new TextDecoder(candidate).decode(dataView);
    } catch {
      // Try the next decoder.
    }
  }

  return "[无法直接解码为文本]";
}

function parseRecord(record) {
  const base = {
    recordType: record.recordType,
    mediaType: record.mediaType || "",
    id: record.id || "",
    byteLength: record.data?.byteLength || 0,
    rawHex: record.data ? bytesToHex(record.data) : "",
  };

  if (!record.data) {
    return base;
  }

  if (record.recordType === "text") {
    return {
      ...base,
      text: readDataViewAsText(record.data, record.encoding || "utf-8"),
      encoding: record.encoding || "",
      lang: record.lang || "",
    };
  }

  if (record.recordType === "url" || record.recordType === "absolute-url") {
    return {
      ...base,
      url: readDataViewAsText(record.data),
    };
  }

  if (record.mediaType) {
    return {
      ...base,
      text: readDataViewAsText(record.data),
    };
  }

  return {
    ...base,
    rawText: readDataViewAsText(record.data),
  };
}

function cleanupReader() {
  if (state.ndef && state.handlers) {
    state.ndef.removeEventListener("reading", state.handlers.reading);
    state.ndef.removeEventListener("readingerror", state.handlers.readingerror);
  }

  state.ndef = null;
  state.handlers = null;
  state.controller = null;
}

function setScanning(active) {
  state.scanning = active;
  scanButton.disabled = active;
  stopButton.disabled = !active;
  scanStateEl.textContent = active ? "扫描中" : "未扫描";
}

function updateResult(event) {
  state.lastReadAt = new Date();
  serialNumberEl.textContent = event.serialNumber || "(空字符串)";
  recordCountEl.textContent = String(event.message.records.length);
  scanTimeEl.textContent = formatNow();

  const parsedRecords = event.message.records.map(parseRecord);
  recordsEl.textContent = JSON.stringify(parsedRecords, null, 2);
}

async function collectDiagnostics() {
  const browser = detectBrowser();
  const permission = await getNfcPermissionState();
  const diagnostics = {
    version: APP_VERSION,
    browser: browser.label,
    recommendedBrowser: browser.isRecommended,
    userAgent: browser.userAgent,
    nfcApiSupported: "NDEFReader" in window,
    permission,
    secureContext: window.isSecureContext,
    topLevel: window.top === window,
    visibility: document.visibilityState,
    origin: window.location.origin,
    href: window.location.href,
    scanning: state.scanning,
    lastError: state.lastError
      ? {
          name: state.lastError.name || "",
          message: state.lastError.message || String(state.lastError),
        }
      : null,
  };

  state.diagnostics = diagnostics;
  return diagnostics;
}

function renderDiagnostics(diagnostics) {
  appVersionEl.textContent = APP_VERSION;
  versionHintEl.textContent = `当前页面版本：${APP_VERSION}`;
  browserStateEl.textContent = diagnostics.browser;
  supportStateEl.textContent = diagnostics.nfcApiSupported ? "支持" : "不支持";
  permissionStateEl.textContent = formatPermission(diagnostics.permission);
  contextStateEl.textContent = diagnostics.secureContext ? "安全上下文" : "非安全上下文";
  topLevelStateEl.textContent = formatBool(diagnostics.topLevel);
  visibilityStateEl.textContent = diagnostics.visibility;
  originStateEl.textContent = diagnostics.origin;
  diagnosticsJsonEl.textContent = JSON.stringify(diagnostics, null, 2);
}

async function refreshDiagnostics() {
  const diagnostics = await collectDiagnostics();
  renderDiagnostics(diagnostics);
  return diagnostics;
}

function buildPreflightHints(diagnostics) {
  const hints = [];

  if (!diagnostics.nfcApiSupported) {
    hints.push("当前浏览器没有暴露 Web NFC API");
  }

  if (!diagnostics.recommendedBrowser) {
    hints.push("当前看起来不是 Android Chrome");
  }

  if (!diagnostics.secureContext) {
    hints.push("当前页面不是安全上下文");
  }

  if (!diagnostics.topLevel) {
    hints.push("当前页面不是顶层页面");
  }

  if (diagnostics.visibility !== "visible") {
    hints.push("当前页面不在前台");
  }

  if (diagnostics.permission === "denied") {
    hints.push("站点 NFC 权限当前是已拒绝");
  }

  return hints;
}

function explainScanError(error, diagnostics) {
  const hints = buildPreflightHints(diagnostics);

  if (error?.name === "NotAllowedError") {
    if (hints.length > 0) {
      return `浏览器拒绝启动 NFC 扫描：${hints.join("；")}。最常见原因是没有用 Android Chrome，或者这个站点的 NFC 权限之前被拒绝了。`;
    }

    return "浏览器拒绝启动 NFC 扫描。请确认你是在 Android Chrome 中直接打开页面，站点权限里允许 NFC，且手机系统 NFC 已开启。";
  }

  if (error?.name === "NotSupportedError") {
    return "当前设备或浏览器不支持 NFC，或者系统里的 NFC 没有开启。";
  }

  if (error?.name === "InvalidStateError") {
    return "已有 NFC 扫描流程正在进行。请先停止扫描，再重新开始。";
  }

  if (error?.name === "AbortError") {
    return "扫描已停止。";
  }

  return `启动扫描失败：${error?.name || "UnknownError"} ${error?.message || ""}`.trim();
}

async function stopScan({ silent = false } = {}) {
  if (state.controller) {
    try {
      state.controller.abort();
    } catch {
      // Ignore abort failures.
    }
  }

  cleanupReader();
  setScanning(false);
  await refreshDiagnostics();

  if (!silent) {
    setStatus("扫描已停止。", "info");
  }
}

async function startScan() {
  await refreshDiagnostics();

  if (state.scanning) {
    await stopScan({ silent: true });
  }

  if (!("NDEFReader" in window)) {
    setStatus("当前浏览器不支持 Web NFC。请改用 Android Chrome 直接打开这个页面。", "error");
    return;
  }

  if (!state.diagnostics.recommendedBrowser) {
    setStatus("当前看起来不是 Android Chrome。很多系统浏览器、内置浏览器即使能打开页面，也会在扫描时直接拒绝。", "error");
    return;
  }

  setStatus("正在请求 NFC 权限。请保持页面在前台，并在浏览器弹窗中允许。", "info");

  try {
    const ndef = new NDEFReader();
    const controller = new AbortController();

    const reading = (event) => {
      updateResult(event);
      setStatus("读取成功。你可以继续贴更多 NFC 标签。", "success");
      refreshDiagnostics();
    };

    const readingerror = () => {
      setStatus("检测到 NFC 标签，但内容无法按 NDEF 方式读取。它可能不是 NDEF 标签。", "error");
    };

    state.ndef = ndef;
    state.controller = controller;
    state.handlers = { reading, readingerror };

    ndef.addEventListener("reading", reading);
    ndef.addEventListener("readingerror", readingerror);

    await ndef.scan({ signal: controller.signal });

    setScanning(true);
    await refreshDiagnostics();
    setStatus("扫描已启动。请把 NFC 卡片贴近手机背面，停留 1 到 2 秒。", "success");
  } catch (error) {
    state.lastError = error;
    cleanupReader();
    setScanning(false);

    const diagnostics = await refreshDiagnostics();
    setStatus(explainScanError(error, diagnostics), "error");
  }
}

scanButton.addEventListener("click", startScan);
stopButton.addEventListener("click", () => stopScan());
refreshButton.addEventListener("click", async () => {
  await refreshDiagnostics();
  setStatus("环境诊断已刷新。", "info");
});

document.addEventListener("visibilitychange", async () => {
  await refreshDiagnostics();

  if (document.visibilityState !== "visible" && state.scanning) {
    setStatus("页面已切到后台。部分浏览器会因此拒绝继续 NFC 扫描。", "error");
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  await refreshDiagnostics();
  setStatus("等待开始。优先用 Android Chrome 直接打开，并确认页面上的版本号是最新的。", "info");
});
