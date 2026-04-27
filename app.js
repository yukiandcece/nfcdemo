import {
  collectNfcDiagnostics,
  createNfcScanner,
  detectNfcBrowser,
  explainNfcScanError,
  explainNfcWriteError,
  isWebNfcSupported,
  writeNfcId,
} from "./nfc-core.js";

const APP_VERSION = "2026.04.27-r4";

const scanButton = document.getElementById("scanButton");
const stopButton = document.getElementById("stopButton");
const refreshButton = document.getElementById("refreshButton");
const writeForm = document.getElementById("writeForm");
const writeInput = document.getElementById("writeInput");
const writeButton = document.getElementById("writeButton");
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
  scanner: null,
  scanning: false,
  writing: false,
  lastError: null,
  lastReadAt: null,
  diagnostics: null,
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

function setScanning(active) {
  state.scanning = active;
  scanButton.disabled = active;
  stopButton.disabled = !active;
  scanStateEl.textContent = active ? "扫描中" : "未扫描";
}

function updateResult(reading) {
  state.lastReadAt = new Date();
  serialNumberEl.textContent = reading.serialNumber || "(空字符串)";
  recordCountEl.textContent = String(reading.records.length);
  scanTimeEl.textContent = formatNow();
  recordsEl.textContent = JSON.stringify(reading.records, null, 2);
}

async function collectDiagnostics() {
  const diagnostics = await collectNfcDiagnostics({
    version: APP_VERSION,
    scanning: state.scanning,
    writing: state.writing,
    lastError: state.lastError
      ? {
          name: state.lastError.name || "",
          message: state.lastError.message || String(state.lastError),
        }
      : null,
  });

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

async function stopScan({ silent = false, refresh = true } = {}) {
  state.scanner?.stop();
  state.scanner = null;
  setScanning(false);

  if (refresh) {
    await refreshDiagnostics();
  }

  if (!silent) {
    setStatus("扫描已停止。", "info");
  }
}

async function writeNfcText(event) {
  event.preventDefault();

  const text = writeInput.value.trim();

  if (!text) {
    setStatus("请输入要写入 NFC 卡片的文本。", "error");
    writeInput.focus();
    return;
  }

  if (!isWebNfcSupported()) {
    setStatus("当前浏览器不支持 Web NFC。请改用 Android Chrome 直接打开这个页面。", "error");
    return;
  }

  if (!detectNfcBrowser().isRecommended) {
    setStatus("当前看起来不是 Android Chrome。很多系统浏览器、内置浏览器即使能打开页面，也会在写入时直接拒绝。", "error");
    return;
  }

  if (state.scanning) {
    await stopScan({ silent: true, refresh: false });
  }

  state.writing = true;
  writeButton.disabled = true;
  setStatus("准备写入。请把 NFC 卡片贴近手机背面，停留 1 到 2 秒。", "info");

  try {
    await writeNfcId(text);
    setStatus("写入成功。", "success");
  } catch (error) {
    state.lastError = error;
    const diagnostics = await refreshDiagnostics();
    setStatus(explainNfcWriteError(error, diagnostics), "error");
  } finally {
    state.writing = false;
    writeButton.disabled = false;
    await refreshDiagnostics();
  }
}

async function startScan() {
  await refreshDiagnostics();

  if (state.scanning) {
    await stopScan({ silent: true });
  }

  if (!isWebNfcSupported()) {
    setStatus("当前浏览器不支持 Web NFC。请改用 Android Chrome 直接打开这个页面。", "error");
    return;
  }

  if (!state.diagnostics.recommendedBrowser) {
    setStatus("当前看起来不是 Android Chrome。很多系统浏览器、内置浏览器即使能打开页面，也会在扫描时直接拒绝。", "error");
    return;
  }

  setStatus("正在请求 NFC 权限。请保持页面在前台，并在浏览器弹窗中允许。", "info");

  try {
    const scanner = createNfcScanner({
      onReading: (reading) => {
        updateResult(reading);
        setStatus("读取成功。你可以继续贴更多 NFC 标签。", "success");
        refreshDiagnostics();
      },
      onReadingError: () => {
        setStatus("检测到 NFC 标签，但内容无法按 NDEF 方式读取。它可能不是 NDEF 标签。", "error");
      },
    });

    state.scanner = scanner;

    await scanner.start();

    setScanning(true);
    await refreshDiagnostics();
    setStatus("扫描已启动。请把 NFC 卡片贴近手机背面，停留 1 到 2 秒。", "success");
  } catch (error) {
    state.lastError = error;
    state.scanner = null;
    setScanning(false);

    const diagnostics = await refreshDiagnostics();
    setStatus(explainNfcScanError(error, diagnostics), "error");
  }
}

scanButton.addEventListener("click", startScan);
stopButton.addEventListener("click", () => stopScan());
writeForm.addEventListener("submit", writeNfcText);
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
