const scanButton = document.getElementById("scanButton");
const statusEl = document.getElementById("status");
const serialNumberEl = document.getElementById("serialNumber");
const recordCountEl = document.getElementById("recordCount");
const scanTimeEl = document.getElementById("scanTime");
const recordsEl = document.getElementById("records");

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

function readDataViewAsText(dataView, encoding = "utf-8") {
  try {
    return new TextDecoder(encoding).decode(dataView);
  } catch {
    return "[无法直接解码为文本]";
  }
}

function parseRecord(record) {
  const base = {
    recordType: record.recordType,
    mediaType: record.mediaType || "",
    id: record.id || "",
  };

  if (!record.data) {
    return base;
  }

  if (record.recordType === "text") {
    return {
      ...base,
      text: record.data ? readDataViewAsText(record.data, record.encoding || "utf-8") : "",
      encoding: record.encoding || "",
      lang: record.lang || "",
    };
  }

  if (record.recordType === "url") {
    return {
      ...base,
      url: readDataViewAsText(record.data),
    };
  }

  return {
    ...base,
    rawText: readDataViewAsText(record.data),
  };
}

function updateResult({ serialNumber, message }) {
  serialNumberEl.textContent = serialNumber || "(空字符串)";
  recordCountEl.textContent = String(message.records.length);
  scanTimeEl.textContent = formatNow();

  const parsedRecords = message.records.map(parseRecord);
  recordsEl.textContent = JSON.stringify(parsedRecords, null, 2);
}

async function startScan() {
  if (!("NDEFReader" in window)) {
    setStatus("当前浏览器不支持 Web NFC，请换成 Android Chrome。", "error");
    return;
  }

  setStatus("正在请求 NFC 权限，请在浏览器中允许。");

  try {
    const ndef = new NDEFReader();
    await ndef.scan();

    setStatus("扫描已启动，请把 NFC 卡贴近手机背面。", "success");

    ndef.addEventListener("readingerror", () => {
      setStatus("检测到 NFC 标签，但内容无法读取。可能不是 NDEF 标签。", "error");
    });

    ndef.addEventListener("reading", (event) => {
      updateResult(event);
      setStatus("读取成功，可以继续刷其他卡。", "success");
    });
  } catch (error) {
    const permissionState = await getNfcPermissionState();
    let message = `启动扫描失败：${error?.message || String(error)}`;

    if (error?.name === "NotAllowedError") {
      const reasons = [];

      if (!window.isSecureContext) {
        reasons.push("当前页面不是安全上下文");
      }

      if (window.top !== window) {
        reasons.push("当前页面不是顶层页面");
      }

      if (document.visibilityState !== "visible") {
        reasons.push("当前页面不可见");
      }

      if (permissionState === "denied") {
        reasons.push("站点的 NFC 权限当前是已拒绝");
      }

      message =
        reasons.length > 0
          ? `浏览器拒绝启动 NFC 扫描：${reasons.join("；")}。请在 Android Chrome 中直接打开 HTTPS 页面，并到站点权限里把 NFC 改成允许或重置权限后重试。`
          : "浏览器拒绝启动 NFC 扫描。请确认你是在 Android Chrome 中直接打开 HTTPS 页面，手机已开启 NFC，并在站点权限里允许 NFC。";
    } else if (error?.name === "NotSupportedError") {
      message = "当前设备不支持 NFC，或系统里的 NFC 没有开启。";
    }

    setStatus(message, "error");
  }
}

scanButton.addEventListener("click", startScan);
