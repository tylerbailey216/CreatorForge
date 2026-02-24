(function () {
  const TOOL = {
    input: null,
    engine: null,
    outputMode: null,
    model: null,
    maxDim: null,
    customColorWrap: null,
    customColor: null,
    threshold: null,
    thresholdLabel: null,
    softness: null,
    softnessLabel: null,
    feather: null,
    featherLabel: null,
    despill: null,
    despillLabel: null,
    hueCenter: null,
    hueWidth: null,
    satMin: null,
    valMin: null,
    exportSeconds: null,
    refreshBtn: null,
    playBtn: null,
    resetBtn: null,
    clearBtn: null,
    downloadImageBtn: null,
    exportVideoBtn: null,
    previewCanvas: null,
    sourceBadge: null,
    engineBadge: null,
    dimensionsLabel: null,
    status: null,
    sourceVideo: null,
    sourceCanvas: null,
    maskCanvas: null,
    featherCanvas: null,
  };

  const state = {
    sourceType: null,
    sourceName: "",
    sourceUrl: null,
    imageEl: null,
    previewLoopActive: false,
    rafId: 0,
    recording: false,
    imageDirty: true,
    aiAvailable: false,
    aiModel: null,
    aiModelSelection: 1,
    aiInitPromise: null,
    aiBusy: false,
    aiLastMask: null,
    aiTargetWidth: 0,
    aiTargetHeight: 0,
    aiPendingResolve: null,
    aiPendingReject: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function smoothstep(edge0, edge1, x) {
    if (edge0 === edge1) {
      return x < edge0 ? 0 : 1;
    }
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function setStatus(message) {
    if (TOOL.status) TOOL.status.textContent = message || "";
  }

  function setEngineBadge(text) {
    if (TOOL.engineBadge) TOOL.engineBadge.textContent = text;
  }

  function formatDims(w, h) {
    return `${w} x ${h}`;
  }

  function getNumeric(el, fallback) {
    const n = parseFloat(el && el.value);
    return Number.isFinite(n) ? n : fallback;
  }

  function hexToRgb(hex) {
    const clean = String(hex || "").replace("#", "").trim();
    const m = clean.match(/^([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i);
    if (!m) return { r: 16, g: 26, b: 42 };
    return {
      r: parseInt(m[1], 16),
      g: parseInt(m[2], 16),
      b: parseInt(m[3], 16),
    };
  }

  function currentSettings() {
    const engine = TOOL.engine ? TOOL.engine.value : "ai";
    const outputMode = TOOL.outputMode ? TOOL.outputMode.value : "transparent";
    return {
      engine,
      outputMode,
      modelSelection: clamp(Math.round(getNumeric(TOOL.model, 1)), 0, 1),
      maxDim: clamp(Math.round(getNumeric(TOOL.maxDim, 960)), 256, 1920),
      threshold: clamp(getNumeric(TOOL.threshold, 46) / 100, 0.01, 0.99),
      softness: clamp(getNumeric(TOOL.softness, 12) / 100, 0, 0.5),
      featherPx: clamp(Math.round(getNumeric(TOOL.feather, 2)), 0, 12),
      despill: clamp(getNumeric(TOOL.despill, 35) / 100, 0, 1),
      hueCenter: clamp(getNumeric(TOOL.hueCenter, 120), 0, 360),
      hueWidth: clamp(getNumeric(TOOL.hueWidth, 55), 1, 180),
      satMin: clamp(getNumeric(TOOL.satMin, 20) / 100, 0, 1),
      valMin: clamp(getNumeric(TOOL.valMin, 8) / 100, 0, 1),
      exportSeconds: clamp(Math.round(getNumeric(TOOL.exportSeconds, 6)), 1, 20),
      bgColor:
        outputMode === "green"
          ? { r: 0, g: 255, b: 0 }
          : outputMode === "custom"
            ? hexToRgb(TOOL.customColor ? TOOL.customColor.value : "#101a2a")
            : null,
    };
  }

  function fitWithinMax(w, h, maxDim, makeEven) {
    if (!w || !h) return { width: 0, height: 0 };
    let width = w;
    let height = h;
    if (maxDim > 0) {
      const scale = Math.min(1, maxDim / Math.max(w, h));
      width = Math.max(1, Math.round(w * scale));
      height = Math.max(1, Math.round(h * scale));
    }
    if (makeEven) {
      if (width % 2) width += 1;
      if (height % 2) height += 1;
    }
    return { width, height };
  }

  function updateLabels() {
    if (TOOL.thresholdLabel) TOOL.thresholdLabel.textContent = `${clamp(Math.round(getNumeric(TOOL.threshold, 46)), 1, 99)}%`;
    if (TOOL.softnessLabel) TOOL.softnessLabel.textContent = `${clamp(Math.round(getNumeric(TOOL.softness, 12)), 0, 50)}%`;
    if (TOOL.featherLabel) TOOL.featherLabel.textContent = `${clamp(Math.round(getNumeric(TOOL.feather, 2)), 0, 12)}px`;
    if (TOOL.despillLabel) TOOL.despillLabel.textContent = `${clamp(Math.round(getNumeric(TOOL.despill, 35)), 0, 100)}%`;

    if (TOOL.customColorWrap && TOOL.outputMode) {
      TOOL.customColorWrap.classList.toggle("bgremover-hidden", TOOL.outputMode.value !== "custom");
    }

    if (TOOL.engine) {
      setEngineBadge(TOOL.engine.value === "chroma" ? "Chroma key mode" : "AI mode");
    }

    updateButtonStates();
  }

  function updateButtonStates() {
    const isVideo = state.sourceType === "video";
    const isImage = state.sourceType === "image";
    if (TOOL.playBtn) {
      TOOL.playBtn.disabled = !isVideo || state.recording;
      TOOL.playBtn.textContent = state.previewLoopActive ? "Pause video" : "Play video";
    }
    if (TOOL.downloadImageBtn) TOOL.downloadImageBtn.disabled = !isImage || state.recording;
    if (TOOL.exportVideoBtn) TOOL.exportVideoBtn.disabled = !isVideo || state.recording;
    if (TOOL.refreshBtn) TOOL.refreshBtn.disabled = !state.sourceType;

    if (TOOL.engine) {
      const aiOption = Array.from(TOOL.engine.options || []).find((opt) => opt.value === "ai");
      if (aiOption && !state.aiAvailable) {
        aiOption.disabled = true;
        aiOption.textContent = "AI subject cutout (model unavailable)";
        if (TOOL.engine.value === "ai") TOOL.engine.value = "chroma";
      }
    }
    if (TOOL.model && TOOL.engine) {
      TOOL.model.disabled = !state.aiAvailable || TOOL.engine.value !== "ai";
    }
  }

  function setSourceBadge(text) {
    if (TOOL.sourceBadge) TOOL.sourceBadge.textContent = text;
  }

  function setDimensionsLabel(text) {
    if (TOOL.dimensionsLabel) TOOL.dimensionsLabel.textContent = text;
  }

  function clearPreviewCanvas() {
    if (!TOOL.previewCanvas) return;
    const canvas = TOOL.previewCanvas;
    const ctx = canvas.getContext("2d");
    canvas.width = 960;
    canvas.height = 540;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#eaf3ff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 24px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText("Background Remover", canvas.width / 2, canvas.height / 2 - 14);
    ctx.fillStyle = "rgba(207,217,255,0.9)";
    ctx.font = "500 14px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText("Upload a photo or video to preview", canvas.width / 2, canvas.height / 2 + 16);
  }

  function stopPreviewLoop() {
    state.previewLoopActive = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
    if (TOOL.sourceVideo) TOOL.sourceVideo.pause();
    updateButtonStates();
  }

  function revokeCurrentSource() {
    stopPreviewLoop();
    if (state.sourceUrl) {
      URL.revokeObjectURL(state.sourceUrl);
      state.sourceUrl = null;
    }
    if (TOOL.sourceVideo) {
      TOOL.sourceVideo.removeAttribute("src");
      TOOL.sourceVideo.load();
    }
    state.sourceType = null;
    state.sourceName = "";
    state.imageEl = null;
    state.imageDirty = true;
    state.aiLastMask = null;
    setSourceBadge("No media loaded");
    setDimensionsLabel("Preview: --");
    clearPreviewCanvas();
    updateButtonStates();
  }

  function getSourceDimensions() {
    if (state.sourceType === "image" && state.imageEl) {
      return {
        width: state.imageEl.naturalWidth || state.imageEl.width || 0,
        height: state.imageEl.naturalHeight || state.imageEl.height || 0,
      };
    }
    if (state.sourceType === "video" && TOOL.sourceVideo) {
      return {
        width: TOOL.sourceVideo.videoWidth || 0,
        height: TOOL.sourceVideo.videoHeight || 0,
      };
    }
    return { width: 0, height: 0 };
  }

  function prepareSourceCanvasFrame(options) {
    if (!TOOL.sourceCanvas) return null;
    const srcDims = getSourceDimensions();
    if (!srcDims.width || !srcDims.height) return null;
    const fitted = fitWithinMax(srcDims.width, srcDims.height, options.maxDim, options.makeEven);
    if (!fitted.width || !fitted.height) return null;

    const canvas = TOOL.sourceCanvas;
    canvas.width = fitted.width;
    canvas.height = fitted.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, fitted.width, fitted.height);

    if (state.sourceType === "image" && state.imageEl) {
      ctx.drawImage(state.imageEl, 0, 0, fitted.width, fitted.height);
    } else if (state.sourceType === "video" && TOOL.sourceVideo) {
      ctx.drawImage(TOOL.sourceVideo, 0, 0, fitted.width, fitted.height);
    } else {
      return null;
    }
    return { width: fitted.width, height: fitted.height };
  }

  function ensurePreviewCanvasSize(w, h) {
    if (!TOOL.previewCanvas) return;
    if (TOOL.previewCanvas.width !== w) TOOL.previewCanvas.width = w;
    if (TOOL.previewCanvas.height !== h) TOOL.previewCanvas.height = h;
  }

  function ensureAIModule() {
    if (state.aiAvailable && state.aiModel) return Promise.resolve(state.aiModel);
    if (state.aiInitPromise) return state.aiInitPromise;

    if (typeof window.SelfieSegmentation === "undefined") {
      state.aiAvailable = false;
      updateButtonStates();
      return Promise.reject(new Error("AI model script not loaded"));
    }

    state.aiInitPromise = (async () => {
      const model = new window.SelfieSegmentation({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      });
      model.setOptions({ modelSelection: 1 });
      model.onResults((results) => {
        try {
          const w = state.aiTargetWidth || (TOOL.sourceCanvas ? TOOL.sourceCanvas.width : 0);
          const h = state.aiTargetHeight || (TOOL.sourceCanvas ? TOOL.sourceCanvas.height : 0);
          if (results && results.segmentationMask && TOOL.maskCanvas && w > 0 && h > 0) {
            const maskCanvas = TOOL.maskCanvas;
            const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
            maskCanvas.width = w;
            maskCanvas.height = h;
            maskCtx.clearRect(0, 0, w, h);
            maskCtx.drawImage(results.segmentationMask, 0, 0, w, h);
            state.aiLastMask = maskCtx.getImageData(0, 0, w, h);
          }
          if (typeof state.aiPendingResolve === "function") state.aiPendingResolve(state.aiLastMask);
        } catch (err) {
          if (typeof state.aiPendingReject === "function") state.aiPendingReject(err);
        } finally {
          state.aiBusy = false;
          state.aiPendingResolve = null;
          state.aiPendingReject = null;
        }
      });
      state.aiModel = model;
      state.aiAvailable = true;
      updateButtonStates();
      return model;
    })().catch((err) => {
      state.aiInitPromise = null;
      state.aiAvailable = false;
      updateButtonStates();
      throw err;
    });

    return state.aiInitPromise;
  }

  async function setAIModelSelection(selection) {
    const desired = clamp(selection, 0, 1);
    if (state.aiModel && state.aiModelSelection === desired) return;
    const model = await ensureAIModule();
    await model.setOptions({ modelSelection: desired });
    state.aiModelSelection = desired;
    state.aiLastMask = null;
  }

  async function runAISegmentation(sourceElement, targetW, targetH) {
    await setAIModelSelection(currentSettings().modelSelection);
    if (!state.aiModel) throw new Error("AI model unavailable");
    if (state.aiBusy) return state.aiLastMask;

    state.aiBusy = true;
    state.aiTargetWidth = targetW;
    state.aiTargetHeight = targetH;

    return new Promise(async (resolve, reject) => {
      state.aiPendingResolve = resolve;
      state.aiPendingReject = reject;
      try {
        await state.aiModel.send({ image: sourceElement });
      } catch (err) {
        state.aiBusy = false;
        state.aiPendingResolve = null;
        state.aiPendingReject = null;
        reject(err);
      }
    });
  }

  function getBlurredMaskImageData(baseMaskImageData, width, height, featherPx) {
    if (!baseMaskImageData || !featherPx || !TOOL.maskCanvas || !TOOL.featherCanvas) {
      return baseMaskImageData;
    }
    const maskCanvas = TOOL.maskCanvas;
    const maskCtx = maskCanvas.getContext("2d");
    maskCanvas.width = width;
    maskCanvas.height = height;
    maskCtx.putImageData(baseMaskImageData, 0, 0);

    const featherCanvas = TOOL.featherCanvas;
    const featherCtx = featherCanvas.getContext("2d", { willReadFrequently: true });
    featherCanvas.width = width;
    featherCanvas.height = height;
    featherCtx.clearRect(0, 0, width, height);
    featherCtx.filter = `blur(${featherPx}px)`;
    featherCtx.drawImage(maskCanvas, 0, 0);
    featherCtx.filter = "none";
    return featherCtx.getImageData(0, 0, width, height);
  }

  function rgbToHsvDeg(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;

    if (d !== 0) {
      if (max === rn) h = ((gn - bn) / d) % 6;
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }

    return {
      h,
      s: max === 0 ? 0 : d / max,
      v: max,
    };
  }

  function applyDespill(r, g, b, alpha, amount) {
    if (amount <= 0) return [r, g, b];
    const edgeFactor = (1 - alpha) * amount;
    if (edgeFactor <= 0.001) return [r, g, b];
    const dominant = Math.max(r, b);
    if (g <= dominant) return [r, g, b];
    const reduced = Math.round(g - (g - dominant) * edgeFactor);
    return [r, clamp(reduced, 0, 255), b];
  }

  function compositeSourceToPreview(maskDataMaybe, settings) {
    if (!TOOL.sourceCanvas || !TOOL.previewCanvas) return false;
    const sourceCanvas = TOOL.sourceCanvas;
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    if (!width || !height) return false;

    ensurePreviewCanvasSize(width, height);

    const srcCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const srcImg = srcCtx.getImageData(0, 0, width, height);
    const src = srcImg.data;

    let maskImg = maskDataMaybe;
    if (settings.engine === "ai") {
      if (!maskImg) {
        const previewCtx = TOOL.previewCanvas.getContext("2d");
        previewCtx.clearRect(0, 0, width, height);
        previewCtx.drawImage(sourceCanvas, 0, 0);
        return true;
      }
      if (settings.featherPx > 0) {
        maskImg = getBlurredMaskImageData(maskImg, width, height, settings.featherPx);
      }
    }

    const outCtx = TOOL.previewCanvas.getContext("2d", { willReadFrequently: true });
    const outImg = outCtx.createImageData(width, height);
    const out = outImg.data;

    const t0 = clamp(settings.threshold - settings.softness, 0, 1);
    const t1 = clamp(settings.threshold + settings.softness, 0, 1);
    const bgColor = settings.bgColor || { r: 0, g: 255, b: 0 };

    for (let i = 0; i < src.length; i += 4) {
      let r = src[i];
      let g = src[i + 1];
      let b = src[i + 2];
      let alphaF = 1;

      if (settings.engine === "ai") {
        const maskVal = (maskImg.data[i] || 0) / 255;
        alphaF = smoothstep(t0, t1, maskVal);
      } else {
        const hsv = rgbToHsvDeg(r, g, b);
        const rawDist = Math.abs(hsv.h - settings.hueCenter);
        const hueDist = Math.min(rawDist, 360 - rawDist);
        const hueNorm = clamp(1 - hueDist / settings.hueWidth, 0, 1);
        const hueMatch = smoothstep(0, 1, hueNorm);

        const satGate = smoothstep(
          clamp(settings.satMin - settings.softness, 0, 1),
          clamp(settings.satMin + settings.softness, 0, 1),
          hsv.s
        );
        const valGate = smoothstep(
          clamp(settings.valMin - settings.softness, 0, 1),
          clamp(settings.valMin + settings.softness, 0, 1),
          hsv.v
        );

        const bgStrength = hueMatch * satGate * valGate;
        const bgAmount = smoothstep(t0, t1, bgStrength);
        alphaF = 1 - bgAmount;

        if (settings.featherPx > 0) {
          const featherMix = clamp(settings.featherPx / 12, 0, 1) * 0.15;
          alphaF = clamp(alphaF + featherMix * (alphaF - 0.5), 0, 1);
        }
      }

      alphaF = clamp(alphaF, 0, 1);
      [r, g, b] = applyDespill(r, g, b, alphaF, settings.despill);

      if (settings.outputMode === "transparent") {
        out[i] = r;
        out[i + 1] = g;
        out[i + 2] = b;
        out[i + 3] = Math.round(alphaF * 255);
      } else {
        out[i] = Math.round(r * alphaF + bgColor.r * (1 - alphaF));
        out[i + 1] = Math.round(g * alphaF + bgColor.g * (1 - alphaF));
        out[i + 2] = Math.round(b * alphaF + bgColor.b * (1 - alphaF));
        out[i + 3] = 255;
      }
    }

    outCtx.putImageData(outImg, 0, 0);
    return true;
  }

  async function renderStillPreview(forceFreshMask) {
    if (state.sourceType !== "image" || !state.imageEl) return;
    const settings = currentSettings();
    const prepared = prepareSourceCanvasFrame({ maxDim: settings.maxDim, makeEven: false });
    if (!prepared) return;

    let mask = null;
    if (settings.engine === "ai") {
      if (!state.aiAvailable) {
        try {
          await ensureAIModule();
        } catch {
          setStatus("AI model unavailable. Switch to Chroma mode or check your internet connection.");
          return;
        }
      }
      if (
        forceFreshMask ||
        !state.aiLastMask ||
        state.aiLastMask.width !== prepared.width ||
        state.aiLastMask.height !== prepared.height
      ) {
        setStatus("Running AI subject cutout...");
        try {
          mask = await runAISegmentation(TOOL.sourceCanvas, prepared.width, prepared.height);
        } catch {
          setStatus("AI segmentation failed. Switch to Chroma mode or try another photo.");
          return;
        }
      } else {
        mask = state.aiLastMask;
      }
    }

    compositeSourceToPreview(mask, settings);
    setSourceBadge(`Photo: ${state.sourceName || "image"}`);
    setDimensionsLabel(`Preview: ${formatDims(prepared.width, prepared.height)}`);
    setStatus(settings.engine === "ai" ? "Preview updated with AI cutout." : "Preview updated with chroma key.");
    state.imageDirty = false;
  }

  function schedulePreviewTick() {
    if (state.rafId) return;
    state.rafId = requestAnimationFrame(previewTick);
  }

  async function previewTick() {
    state.rafId = 0;
    if (!state.previewLoopActive || state.sourceType !== "video" || !TOOL.sourceVideo) return;
    if (TOOL.sourceVideo.paused || TOOL.sourceVideo.ended) {
      state.previewLoopActive = false;
      updateButtonStates();
      return;
    }

    const settings = currentSettings();
    const prepared = prepareSourceCanvasFrame({ maxDim: settings.maxDim, makeEven: true });
    if (!prepared) {
      schedulePreviewTick();
      return;
    }

    if (settings.engine === "ai" && state.aiAvailable && !state.aiBusy) {
      runAISegmentation(TOOL.sourceCanvas, prepared.width, prepared.height).catch(() => {
        if (!state.recording) setStatus("AI frame analysis hiccup. Continuing preview...");
      });
    }

    compositeSourceToPreview(settings.engine === "ai" ? state.aiLastMask : null, settings);
    setSourceBadge(`Video: ${state.sourceName || "clip"}`);
    setDimensionsLabel(`Preview: ${formatDims(prepared.width, prepared.height)}`);
    schedulePreviewTick();
  }

  async function renderCurrentPreview(options) {
    const forceFreshMask = !!(options && options.forceFreshMask);
    if (!state.sourceType) {
      clearPreviewCanvas();
      setStatus("Upload a photo or video to start background removal.");
      return;
    }

    if (state.sourceType === "image") {
      await renderStillPreview(forceFreshMask || state.imageDirty);
      return;
    }

    const settings = currentSettings();
    const prepared = prepareSourceCanvasFrame({ maxDim: settings.maxDim, makeEven: true });
    if (!prepared) return;

    if (settings.engine === "ai") {
      if (!state.aiAvailable) {
        try {
          await ensureAIModule();
        } catch {
          setStatus("AI model unavailable. Switch to Chroma mode or check your internet connection.");
          return;
        }
      }
      if (
        forceFreshMask ||
        !state.aiLastMask ||
        state.aiLastMask.width !== prepared.width ||
        state.aiLastMask.height !== prepared.height
      ) {
        setStatus("Analyzing current video frame...");
        try {
          await runAISegmentation(TOOL.sourceCanvas, prepared.width, prepared.height);
        } catch {
          setStatus("AI segmentation failed on this frame. Try Chroma mode.");
        }
      }
    }

    compositeSourceToPreview(settings.engine === "ai" ? state.aiLastMask : null, settings);
    setSourceBadge(`Video: ${state.sourceName || "clip"}`);
    setDimensionsLabel(`Preview: ${formatDims(prepared.width, prepared.height)}`);
    setStatus("Video frame preview updated.");
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function downloadImageResult() {
    if (state.sourceType !== "image") {
      alert("Load a photo first to download a PNG.");
      return;
    }
    await renderCurrentPreview({ forceFreshMask: true });
    if (!TOOL.previewCanvas) return;
    TOOL.previewCanvas.toBlob((blob) => {
      if (!blob) {
        alert("Could not generate PNG output.");
        return;
      }
      const base = (state.sourceName || "creatorforge-cutout").replace(/\.[^.]+$/, "");
      const suffix = currentSettings().outputMode === "transparent" ? "_transparent" : "_bgswap";
      downloadBlob(blob, `${base}${suffix}.png`);
      setStatus("Downloaded processed PNG.");
    }, "image/png", 0.95);
  }

  function pickWebMMime() {
    const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    for (const type of candidates) {
      try {
        if (typeof MediaRecorder.isTypeSupported !== "function" || MediaRecorder.isTypeSupported(type)) {
          return type;
        }
      } catch {
        // continue
      }
    }
    return "";
  }

  function waitForEvent(target, eventName, timeoutMs) {
    return new Promise((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        target.removeEventListener(eventName, done);
        resolve();
      };
      target.addEventListener(eventName, done, { once: true });
      if (timeoutMs) setTimeout(done, timeoutMs);
    });
  }

  async function toggleVideoPlayback() {
    if (state.sourceType !== "video" || !TOOL.sourceVideo) {
      alert("Load a video to use playback.");
      return;
    }

    if (state.previewLoopActive) {
      stopPreviewLoop();
      setStatus("Paused video preview.");
      return;
    }

    if (currentSettings().engine === "ai" && !state.aiAvailable) {
      try {
        setStatus("Loading AI model...");
        await ensureAIModule();
      } catch {
        setStatus("AI model unavailable. Switch to Chroma mode or check your internet connection.");
      }
    }

    try {
      await TOOL.sourceVideo.play();
      state.previewLoopActive = true;
      updateButtonStates();
      setStatus("Playing processed video preview.");
      schedulePreviewTick();
    } catch {
      setStatus("Video playback was blocked. Press Play again.");
    }
  }

  async function exportVideoResult() {
    if (state.sourceType !== "video" || !TOOL.sourceVideo || !TOOL.previewCanvas) {
      alert("Load a video first to export WebM.");
      return;
    }
    if (typeof MediaRecorder === "undefined" || typeof TOOL.previewCanvas.captureStream !== "function") {
      alert("This browser does not support canvas video export.");
      return;
    }
    if (state.recording) return;

    let stream = null;
    let recorder = null;
    const chunks = [];
    let recorderResolve = null;
    const recorderDone = new Promise((resolve) => {
      recorderResolve = resolve;
    });
    let recorderHadError = false;
    const wasPlaying = state.previewLoopActive;
    const settings = currentSettings();
    const transparentMode = settings.outputMode === "transparent";

    try {
      await renderCurrentPreview({ forceFreshMask: true });

      const mimeType = pickWebMMime();
      stream = TOOL.previewCanvas.captureStream(30);
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 })
        : new MediaRecorder(stream, { videoBitsPerSecond: 8_000_000 });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        recorderHadError = true;
      };
      recorder.onstop = () => {
        recorderResolve();
      };

      stopPreviewLoop();
      state.recording = true;
      updateButtonStates();

      try {
        TOOL.sourceVideo.currentTime = 0;
        await waitForEvent(TOOL.sourceVideo, "seeked", 800);
      } catch {
        // continue
      }

      setStatus(
        transparentMode
          ? "Recording transparent WebM (beta; browser support varies)..."
          : "Recording WebM export..."
      );

      recorder.start(200);
      try {
        await TOOL.sourceVideo.play();
      } catch {
        // continue; preview loop may still render current frame
      }
      state.previewLoopActive = true;
      updateButtonStates();
      schedulePreviewTick();

      await new Promise((resolve) => setTimeout(resolve, settings.exportSeconds * 1000));

      if (recorder.state !== "inactive") recorder.stop();
      await recorderDone;

      stopPreviewLoop();
      try {
        TOOL.sourceVideo.currentTime = 0;
        await waitForEvent(TOOL.sourceVideo, "seeked", 800);
      } catch {
        // continue
      }
      await renderCurrentPreview({ forceFreshMask: true });

      if (recorderHadError) throw new Error("MediaRecorder error");

      const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
      if (!blob.size) throw new Error("Empty export");

      const base = (state.sourceName || "creatorforge-cutout").replace(/\.[^.]+$/, "");
      const suffix = transparentMode ? "_transparent_beta" : "_greenscreen";
      downloadBlob(blob, `${base}${suffix}.webm`);
      setStatus(
        transparentMode
          ? "Downloaded WebM export (transparent is beta and browser-dependent)."
          : "Downloaded WebM export."
      );
    } catch {
      setStatus("WebM export failed. Try lowering Max processing size or switching mode.");
      alert("WebM export failed. Try lowering Max processing size or using Chroma output.");
    } finally {
      state.recording = false;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (wasPlaying && state.sourceType === "video") {
        try {
          await TOOL.sourceVideo.play();
          state.previewLoopActive = true;
          schedulePreviewTick();
        } catch {
          state.previewLoopActive = false;
        }
      }
      updateButtonStates();
    }
  }

  function clearMedia() {
    revokeCurrentSource();
    if (TOOL.input) TOOL.input.value = "";
    setStatus("Cleared background remover media.");
    updateLabels();
  }

  function resetSettings() {
    if (TOOL.engine) TOOL.engine.value = state.aiAvailable ? "ai" : "chroma";
    if (TOOL.outputMode) TOOL.outputMode.value = "transparent";
    if (TOOL.model) TOOL.model.value = "1";
    if (TOOL.maxDim) TOOL.maxDim.value = "960";
    if (TOOL.customColor) TOOL.customColor.value = "#101a2a";
    if (TOOL.threshold) TOOL.threshold.value = "46";
    if (TOOL.softness) TOOL.softness.value = "12";
    if (TOOL.feather) TOOL.feather.value = "2";
    if (TOOL.despill) TOOL.despill.value = "35";
    if (TOOL.hueCenter) TOOL.hueCenter.value = "120";
    if (TOOL.hueWidth) TOOL.hueWidth.value = "55";
    if (TOOL.satMin) TOOL.satMin.value = "20";
    if (TOOL.valMin) TOOL.valMin.value = "8";
    if (TOOL.exportSeconds) TOOL.exportSeconds.value = "6";
    state.aiLastMask = null;
    state.imageDirty = true;
    updateLabels();
    if (state.sourceType) {
      renderCurrentPreview({ forceFreshMask: true });
    } else {
      clearPreviewCanvas();
      setStatus("Reset background remover settings.");
    }
  }

  async function onMediaInputChange() {
    const file = TOOL.input && TOOL.input.files ? TOOL.input.files[0] : null;
    if (!file) return;

    revokeCurrentSource();
    state.sourceName = file.name || "";
    state.sourceUrl = URL.createObjectURL(file);
    state.aiLastMask = null;
    state.imageDirty = true;

    const isImage = /^image\//i.test(file.type);
    const isVideo = /^video\//i.test(file.type);

    try {
      if (isImage) {
        const img = new Image();
        img.decoding = "async";
        img.src = state.sourceUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        state.imageEl = img;
        state.sourceType = "image";
        setSourceBadge(`Photo: ${state.sourceName}`);
        setStatus("Photo loaded. Tweak settings and refresh preview if needed.");
        await renderCurrentPreview({ forceFreshMask: true });
      } else if (isVideo) {
        state.sourceType = "video";
        if (!TOOL.sourceVideo) throw new Error("Video element missing");
        TOOL.sourceVideo.src = state.sourceUrl;
        TOOL.sourceVideo.muted = true;
        TOOL.sourceVideo.loop = true;
        TOOL.sourceVideo.playsInline = true;

        await waitForEvent(TOOL.sourceVideo, "loadeddata", 3000);
        try {
          TOOL.sourceVideo.currentTime = 0;
          await waitForEvent(TOOL.sourceVideo, "seeked", 900);
        } catch {
          // continue
        }

        setSourceBadge(`Video: ${state.sourceName}`);
        setStatus("Video loaded. Preview ready.");
        await renderCurrentPreview({ forceFreshMask: true });
      } else {
        throw new Error("Unsupported media type");
      }
    } catch {
      clearMedia();
      setStatus("Could not load that file. Try another image or video.");
      alert("Could not load the selected file.");
    }

    updateButtonStates();
  }

  function onControlsChanged() {
    updateLabels();
    state.aiLastMask = null;
    state.imageDirty = true;
    if (!state.sourceType) return;
    renderCurrentPreview({ forceFreshMask: true });
    if (state.previewLoopActive) schedulePreviewTick();
  }

  function collectElements() {
    TOOL.input = $("bgremoverInput");
    TOOL.engine = $("bgremoverEngine");
    TOOL.outputMode = $("bgremoverOutputMode");
    TOOL.model = $("bgremoverModel");
    TOOL.maxDim = $("bgremoverMaxDim");
    TOOL.customColorWrap = $("bgremoverCustomColorWrap");
    TOOL.customColor = $("bgremoverCustomColor");
    TOOL.threshold = $("bgremoverThreshold");
    TOOL.thresholdLabel = $("bgremoverThresholdLabel");
    TOOL.softness = $("bgremoverSoftness");
    TOOL.softnessLabel = $("bgremoverSoftnessLabel");
    TOOL.feather = $("bgremoverFeather");
    TOOL.featherLabel = $("bgremoverFeatherLabel");
    TOOL.despill = $("bgremoverDespill");
    TOOL.despillLabel = $("bgremoverDespillLabel");
    TOOL.hueCenter = $("bgremoverHueCenter");
    TOOL.hueWidth = $("bgremoverHueWidth");
    TOOL.satMin = $("bgremoverSatMin");
    TOOL.valMin = $("bgremoverValMin");
    TOOL.exportSeconds = $("bgremoverExportSeconds");
    TOOL.refreshBtn = $("bgremoverRefreshBtn");
    TOOL.playBtn = $("bgremoverPlayBtn");
    TOOL.resetBtn = $("bgremoverResetBtn");
    TOOL.clearBtn = $("bgremoverClearBtn");
    TOOL.downloadImageBtn = $("bgremoverDownloadImageBtn");
    TOOL.exportVideoBtn = $("bgremoverExportVideoBtn");
    TOOL.previewCanvas = $("bgremoverCanvas");
    TOOL.sourceBadge = $("bgremoverSourceBadge");
    TOOL.engineBadge = $("bgremoverEngineBadge");
    TOOL.dimensionsLabel = $("bgremoverDimensionsLabel");
    TOOL.status = $("bgremoverStatus");
    TOOL.sourceVideo = $("bgremoverSourceVideo");
    TOOL.sourceCanvas = $("bgremoverSourceCanvas");
    TOOL.maskCanvas = $("bgremoverMaskCanvas");
    TOOL.featherCanvas = $("bgremoverFeatherCanvas");
  }

  function bindEvents() {
    if (!TOOL.input) return;

    TOOL.input.addEventListener("change", onMediaInputChange);
    if (TOOL.refreshBtn) TOOL.refreshBtn.addEventListener("click", () => renderCurrentPreview({ forceFreshMask: true }));
    if (TOOL.playBtn) TOOL.playBtn.addEventListener("click", toggleVideoPlayback);
    if (TOOL.resetBtn) TOOL.resetBtn.addEventListener("click", resetSettings);
    if (TOOL.clearBtn) TOOL.clearBtn.addEventListener("click", clearMedia);
    if (TOOL.downloadImageBtn) TOOL.downloadImageBtn.addEventListener("click", downloadImageResult);
    if (TOOL.exportVideoBtn) TOOL.exportVideoBtn.addEventListener("click", exportVideoResult);

    const controlEls = [
      TOOL.engine,
      TOOL.outputMode,
      TOOL.model,
      TOOL.maxDim,
      TOOL.customColor,
      TOOL.threshold,
      TOOL.softness,
      TOOL.feather,
      TOOL.despill,
      TOOL.hueCenter,
      TOOL.hueWidth,
      TOOL.satMin,
      TOOL.valMin,
      TOOL.exportSeconds,
    ];

    controlEls.forEach((el) => {
      if (!el) return;
      el.addEventListener("change", onControlsChanged);
      if (el.type === "range") {
        el.addEventListener("input", onControlsChanged);
      } else {
        el.addEventListener("input", updateLabels);
      }
    });

    if (TOOL.sourceVideo) {
      TOOL.sourceVideo.addEventListener("play", () => {
        state.previewLoopActive = true;
        updateButtonStates();
        schedulePreviewTick();
      });
      TOOL.sourceVideo.addEventListener("pause", () => {
        if (!state.recording) {
          state.previewLoopActive = false;
          updateButtonStates();
        }
      });
      TOOL.sourceVideo.addEventListener("ended", () => {
        if (!state.recording) {
          state.previewLoopActive = false;
          updateButtonStates();
        }
      });
      TOOL.sourceVideo.addEventListener("seeked", () => {
        if (!state.previewLoopActive && state.sourceType === "video") {
          renderCurrentPreview({ forceFreshMask: true });
        }
      });
    }
  }

  function init() {
    collectElements();
    if (!TOOL.input || !TOOL.previewCanvas) return;
    state.aiAvailable = typeof window.SelfieSegmentation !== "undefined";
    clearPreviewCanvas();
    setSourceBadge("No media loaded");
    setDimensionsLabel("Preview: --");
    updateLabels();
    bindEvents();

    if (!state.aiAvailable) {
      setStatus("AI model script did not load. Chroma key mode is still available.");
    } else {
      setStatus("Upload a photo or video to start background removal.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
