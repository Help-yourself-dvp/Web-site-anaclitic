"use strict";
(() => {
  // src/options.ts
  var $ = (selector) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u044D\u043B\u0435\u043C\u0435\u043D\u0442 ${selector}`);
    return element;
  };
  var adapterName = $("#adapterName");
  var maxPages = $("#maxPages");
  var delayMs = $("#delayMs");
  var imageMode = $("#imageMode");
  var imageKeywords = $("#imageKeywords");
  var downloadImages = $("#downloadImages");
  var companionUrl = $("#companionUrl");
  var settingsStatus = $("#settingsStatus");
  async function send(request) {
    return chrome.runtime.sendMessage(request);
  }
  function setStatus(message, kind = "neutral") {
    settingsStatus.textContent = message;
    settingsStatus.className = `status ${kind}`;
  }
  function fill(settings) {
    adapterName.value = settings.adapterName;
    maxPages.value = String(settings.maxPages);
    delayMs.value = String(settings.delayMs);
    imageMode.value = settings.imageMode;
    imageKeywords.value = settings.imageKeywords.join(", ");
    downloadImages.checked = settings.downloadImages;
    companionUrl.value = settings.companionUrl;
  }
  async function load() {
    const response = await send({ type: "get-settings" });
    if (response.ok && "settings" in response) fill(response.settings);
    else if (!response.ok) setStatus(response.error, "error");
    else setStatus("\u0421\u0435\u0440\u0432\u0438\u0441 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F \u0432\u0435\u0440\u043D\u0443\u043B \u043D\u0435\u043E\u0436\u0438\u0434\u0430\u043D\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442.", "error");
  }
  $("#saveSettings").addEventListener("click", () => {
    void (async () => {
      const settings = {
        companionUrl: companionUrl.value.trim().replace(/\/$/, ""),
        adapterName: adapterName.value,
        maxPages: Number(maxPages.value),
        delayMs: Number(delayMs.value),
        imageMode: imageMode.value,
        imageKeywords: imageKeywords.value.split(",").map((item) => item.trim()).filter(Boolean),
        downloadImages: downloadImages.checked
      };
      const response = await send({ type: "save-settings", settings });
      if (response.ok && "settings" in response) {
        fill(response.settings);
        setStatus("\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.", "success");
      } else if (!response.ok) setStatus(response.error, "error");
      else setStatus("\u0421\u0435\u0440\u0432\u0438\u0441 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F \u0432\u0435\u0440\u043D\u0443\u043B \u043D\u0435\u043E\u0436\u0438\u0434\u0430\u043D\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442.", "error");
    })();
  });
  $("#testCompanion").addEventListener("click", () => {
    void (async () => {
      setStatus("\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u044E \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0441\u0435\u0440\u0432\u0438\u0441\u2026");
      const response = await send({ type: "test-companion" });
      if (!response.ok) setStatus(response.error, "warning");
      else if ("message" in response) setStatus(response.message, "success");
      else setStatus("Companion \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442.", "success");
    })();
  });
  void load().catch((error) => setStatus(error instanceof Error ? error.message : String(error), "error"));
})();
