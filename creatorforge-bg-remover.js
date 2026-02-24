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
    previewWrap: null,
    livePreviewCanvas: null,
    previewMode: null,
    previewBg: null,
    previewZoom: null,
    previewZoomLabel: null,
    previewSplitWrap: null,
    previewSplit: null,
    previewSplitLabel: null,
    subjectScale: null,
    subjectScaleLabel: null,
    offsetX: null,
    offsetXLabel: null,
    offsetY: null,
    offsetYLabel: null,
    videoControlsWrap: null,
    videoSeek: null,
    videoSeekLabel: null,
    playbackRate: null,
    playbackRateLabel: null,
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
    isScrubbing: false,
    lastOutputAlphaCoverage: 1,
    lastOutputLooksEmpty: false,
    suspendLivePreviewRender: false,
    lastVideoUiSyncAt: 0,
    lastAISendAt: 0,
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

  function formatClock(seconds) {
    const s = Math.max(0, Number(seconds) || 0);
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
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
    const baseFeather = clamp(Math.round(getNumeric(TOOL.feather, 2)), 0, 12);
    let effectiveFeather = baseFeather;
    if (outputMode === "green") effectiveFeather = Math.max(0, effectiveFeather - 1);
    if (state.recording) effectiveFeather = Math.max(0, Math.floor(effectiveFeather * 0.6));
    const settings = {
      engine,
      outputMode,
      modelSelection: clamp(Math.round(getNumeric(TOOL.model, 1)), 0, 1),
      maxDim: clamp(Math.round(getNumeric(TOOL.maxDim, 960)), 256, 1920),
      threshold: clamp(getNumeric(TOOL.threshold, 46) / 100, 0.01, 0.99),
      softness: clamp(getNumeric(TOOL.softness, 12) / 100, 0, 0.5),
      featherPx: baseFeather,
      effectiveFeatherPx: effectiveFeather,
      despill: clamp(getNumeric(TOOL.despill, 35) / 100, 0, 1),
      hueCenter: clamp(getNumeric(TOOL.hueCenter, 120), 0, 360),
      hueWidth: clamp(getNumeric(TOOL.hueWidth, 55), 1, 180),
      satMin: clamp(getNumeric(TOOL.satMin, 20) / 100, 0, 1),
      valMin: clamp(getNumeric(TOOL.valMin, 8) / 100, 0, 1),
      exportSeconds: clamp(Math.round(getNumeric(TOOL.exportSeconds, 6)), 1, 20),
      previewMode: TOOL.previewMode ? TOOL.previewMode.value : "result",
      previewBg: TOOL.previewBg ? TOOL.previewBg.value : "checker",
      previewZoom: clamp(Math.round(getNumeric(TOOL.previewZoom, 100)), 50, 220),
      previewSplit: clamp(getNumeric(TOOL.previewSplit, 50) / 100, 0, 1),
      subjectScale: clamp(getNumeric(TOOL.subjectScale, 100) / 100, 0.7, 1.4),
      offsetX: clamp(getNumeric(TOOL.offsetX, 0) / 100, -0.4, 0.4),
      offsetY: clamp(getNumeric(TOOL.offsetY, 0) / 100, -0.4, 0.4),
      playbackRate: clamp(getNumeric(TOOL.playbackRate, 100) / 100, 0.25, 2.0),
      aiEdgeTighten: outputMode === "transparent" ? 0.1 : 0.28,
      aiMatteShrink: outputMode === "transparent" ? 0.0 : 0.035,
      bgColor:
        outputMode === "green"
          ? { r: 0, g: 255, b: 0 }
          : outputMode === "custom"
            ? hexToRgb(TOOL.customColor ? TOOL.customColor.value : "#101a2a")
            : null,
    };
    return settings;
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
    if (TOOL.previewZoomLabel) TOOL.previewZoomLabel.textContent = `${clamp(Math.round(getNumeric(TOOL.previewZoom, 100)), 50, 220)}%`;
    if (TOOL.previewSplitLabel) TOOL.previewSplitLabel.textContent = `${clamp(Math.round(getNumeric(TOOL.previewSplit, 50)), 0, 100)}%`;
    if (TOOL.subjectScaleLabel) TOOL.subjectScaleLabel.textContent = `${clamp(Math.round(getNumeric(TOOL.subjectScale, 100)), 70, 140)}%`;
    if (TOOL.offsetXLabel) TOOL.offsetXLabel.textContent = `${Math.round(clamp(getNumeric(TOOL.offsetX, 0), -40, 40))}%`;
    if (TOOL.offsetYLabel) TOOL.offsetYLabel.textContent = `${Math.round(clamp(getNumeric(TOOL.offsetY, 0), -40, 40))}%`;
    if (TOOL.playbackRateLabel) {
      TOOL.playbackRateLabel.textContent = `${clamp(getNumeric(TOOL.playbackRate, 100) / 100, 0.25, 2).toFixed(2)}x`;
    }

    if (TOOL.customColorWrap && TOOL.outputMode) {
      TOOL.customColorWrap.classList.toggle("bgremover-hidden", TOOL.outputMode.value !== "custom");
    }
    if (TOOL.previewSplitWrap && TOOL.previewMode) {
      TOOL.previewSplitWrap.classList.toggle("bgremover-hidden", TOOL.previewMode.value !== "split");
    }
    if (TOOL.previewWrap && TOOL.previewBg) {
      TOOL.previewWrap.setAttribute("data-preview-bg", TOOL.previewBg.value || "checker");
    }
    if (TOOL.livePreviewCanvas && TOOL.previewZoom) {
      TOOL.livePreviewCanvas.style.width = `${clamp(Math.round(getNumeric(TOOL.previewZoom, 100)), 50, 220)}%`;
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
    if (TOOL.videoControlsWrap) TOOL.videoControlsWrap.classList.toggle("bgremover-hidden", !isVideo);
    if (TOOL.videoSeek) TOOL.videoSeek.disabled = !isVideo || state.recording;
    if (TOOL.playbackRate) TOOL.playbackRate.disabled = !isVideo || state.recording;

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

  function syncVideoPreviewUI() {
    if (!TOOL.sourceVideo || !TOOL.videoSeek || !TOOL.videoSeekLabel) return;
    const isVideo = state.sourceType === "video";
    if (!isVideo) {
      TOOL.videoSeek.value = "0";
      TOOL.videoSeekLabel.textContent = "0:00";
      return;
    }
    const dur = TOOL.sourceVideo.duration;
    const current = TOOL.sourceVideo.currentTime || 0;
    if (Number.isFinite(dur) && dur > 0) {
      if (!state.isScrubbing) {
        TOOL.videoSeek.value = String(Math.round((current / dur) * 1000));
      }
      TOOL.videoSeekLabel.textContent = `${formatClock(current)} / ${formatClock(dur)}`;
    } else {
      TOOL.videoSeek.value = "0";
      TOOL.videoSeekLabel.textContent = `${formatClock(current)} / --`;
    }
  }

  function clearPreviewCanvas() {
    if (TOOL.previewCanvas) {
      const outCanvas = TOOL.previewCanvas;
      const outCtx = outCanvas.getContext("2d");
      outCanvas.width = 960;
      outCanvas.height = 540;
      outCtx.clearRect(0, 0, outCanvas.width, outCanvas.height);
    }
    drawLivePreviewPlaceholder();
  }

  function drawLivePreviewPlaceholder() {
    const canvas = TOOL.livePreviewCanvas || TOOL.previewCanvas;
    if (!canvas) return;
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
    state.lastOutputAlphaCoverage = 1;
    state.lastOutputLooksEmpty = false;
    setSourceBadge("No media loaded");
    setDimensionsLabel("Preview: --");
    clearPreviewCanvas();
    syncVideoPreviewUI();
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

  function drawCanvasIntoFrame(ctx, sourceCanvas, frame, settings) {
    if (!sourceCanvas) return;
    const sw = sourceCanvas.width || 0;
    const sh = sourceCanvas.height || 0;
    if (!sw || !sh) return;

    const scale = settings && settings.subjectScale ? settings.subjectScale : 1;
    const offsetX = settings && settings.offsetX ? settings.offsetX : 0;
    const offsetY = settings && settings.offsetY ? settings.offsetY : 0;

    const baseScale = Math.min(frame.w / sw, frame.h / sh);
    const drawW = sw * baseScale * scale;
    const drawH = sh * baseScale * scale;
    const dx = frame.x + (frame.w - drawW) / 2 + offsetX * frame.w;
    const dy = frame.y + (frame.h - drawH) / 2 + offsetY * frame.h;

    ctx.drawImage(sourceCanvas, dx, dy, drawW, drawH);
  }

  function drawPreviewTag(ctx, text, x, y) {
    ctx.save();
    ctx.font = "600 11px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    const padX = 7;
    const h = 19;
    const w = Math.ceil(ctx.measureText(text).width + padX * 2);
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#eaf3ff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + padX, y + h / 2);
    ctx.restore();
  }

  function drawPreviewMessage(ctx, text, x, y) {
    ctx.save();
    ctx.font = "600 12px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    const padX = 8;
    const h = 22;
    const w = Math.ceil(ctx.measureText(text).width + padX * 2);
    ctx.fillStyle = "rgba(11, 15, 24, 0.72)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#ffd59b";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + padX, y + h / 2);
    ctx.restore();
  }

  function renderLivePreview(settingsArg) {
    const liveCanvas = TOOL.livePreviewCanvas || TOOL.previewCanvas;
    const processedCanvas = TOOL.previewCanvas;
    const sourceCanvas = TOOL.sourceCanvas;
    if (!liveCanvas || !processedCanvas) return;

    const settings = settingsArg || currentSettings();
    const sw = processedCanvas.width || 0;
    const sh = processedCanvas.height || 0;
    if (!sw || !sh || !sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) {
      drawLivePreviewPlaceholder();
      return;
    }

    const mode = settings.previewMode || "result";
    const gap = 12;
    const liveW = mode === "side" ? sw * 2 + gap : sw;
    const liveH = sh;
    if (liveCanvas.width !== liveW) liveCanvas.width = liveW;
    if (liveCanvas.height !== liveH) liveCanvas.height = liveH;

    const ctx = liveCanvas.getContext("2d");
    ctx.clearRect(0, 0, liveW, liveH);

    if (mode === "side") {
      const left = { x: 0, y: 0, w: sw, h: sh };
      const right = { x: sw + gap, y: 0, w: sw, h: sh };

      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(left.x, left.y, left.w, left.h);
      ctx.fillRect(right.x, right.y, right.w, right.h);
      drawCanvasIntoFrame(ctx, sourceCanvas, left, settings);
      drawCanvasIntoFrame(ctx, processedCanvas, right, settings);
      ctx.restore();

      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(sw, 0, gap, sh);
      ctx.restore();

      drawPreviewTag(ctx, "Before", 8, 8);
      drawPreviewTag(ctx, "After", sw + gap + 8, 8);
      if (state.lastOutputLooksEmpty) {
        drawPreviewMessage(ctx, "No foreground detected: adjust settings or switch mode", sw + gap + 8, 34);
      }
      return;
    }

    const frame = { x: 0, y: 0, w: sw, h: sh };
    if (mode === "split") {
      const splitX = Math.round(sw * (settings.previewSplit || 0.5));
      drawCanvasIntoFrame(ctx, sourceCanvas, frame, settings);
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, sw - splitX, sh);
      ctx.clip();
      drawCanvasIntoFrame(ctx, processedCanvas, frame, settings);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(splitX + 0.5, 0);
      ctx.lineTo(splitX + 0.5, sh);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath();
      ctx.arc(splitX, sh * 0.5, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      drawPreviewTag(ctx, "Before", 8, 8);
      drawPreviewTag(ctx, "After", Math.max(8, splitX + 12), 8);
      if (state.lastOutputLooksEmpty) {
        drawPreviewMessage(ctx, "No foreground detected: adjust settings or switch mode", 8, 34);
      }
      return;
    }

    if (state.lastOutputLooksEmpty) {
      drawCanvasIntoFrame(ctx, sourceCanvas, frame, settings);
      drawPreviewTag(ctx, "Source (preview fallback)", 8, 8);
      drawPreviewMessage(ctx, "Result is empty with current settings", 8, 34);
    } else {
      drawCanvasIntoFrame(ctx, processedCanvas, frame, settings);
      drawPreviewTag(ctx, "Processed", 8, 8);
    }
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
        state.lastOutputAlphaCoverage = 1;
        state.lastOutputLooksEmpty = false;
        renderLivePreview(settings);
        return true;
      }
      if (settings.effectiveFeatherPx > 0) {
        maskImg = getBlurredMaskImageData(maskImg, width, height, settings.effectiveFeatherPx);
      }
    }

    const outCtx = TOOL.previewCanvas.getContext("2d", { willReadFrequently: true });
    const outImg = outCtx.createImageData(width, height);
    const out = outImg.data;

    const t0 = clamp(settings.threshold - settings.softness, 0, 1);
    const t1 = clamp(settings.threshold + settings.softness, 0, 1);
    const bgColor = settings.bgColor || { r: 0, g: 255, b: 0 };
    let alphaCoverageSum = 0;

    for (let i = 0; i < src.length; i += 4) {
      let r = src[i];
      let g = src[i + 1];
      let b = src[i + 2];
      let alphaF = 1;

      if (settings.engine === "ai") {
        const maskVal = (maskImg.data[i] || 0) / 255;
        alphaF = smoothstep(t0, t1, maskVal);
        // Conservative matte tightening to reduce AI halo/fringe without clipping the subject.
        alphaF = Math.pow(alphaF, 1 + (settings.aiEdgeTighten || 0));
        if (settings.aiMatteShrink > 0 && settings.outputMode !== "transparent") {
          const shrink = clamp(settings.aiMatteShrink, 0, 0.2);
          alphaF = clamp((alphaF - shrink) / Math.max(0.0001, 1 - shrink), 0, 1);
        }
        if (alphaF < 0.008) alphaF = 0;
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
      alphaCoverageSum += alphaF;
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
    state.lastOutputAlphaCoverage = src.length ? (alphaCoverageSum / (src.length / 4)) : 0;
    state.lastOutputLooksEmpty = settings.outputMode === "transparent" && state.lastOutputAlphaCoverage < 0.01;
    if (!state.suspendLivePreviewRender) {
      renderLivePreview(settings);
    }
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

    const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    const aiMinIntervalMs = state.recording ? 140 : 70;
    if (
      settings.engine === "ai" &&
      state.aiAvailable &&
      !state.aiBusy &&
      (now - state.lastAISendAt) >= aiMinIntervalMs
    ) {
      state.lastAISendAt = now;
      runAISegmentation(TOOL.sourceCanvas, prepared.width, prepared.height).catch(() => {
        if (!state.recording) setStatus("AI frame analysis hiccup. Continuing preview...");
      });
    }

    compositeSourceToPreview(settings.engine === "ai" ? state.aiLastMask : null, settings);
    if (!state.recording && (now - state.lastVideoUiSyncAt) > 120) {
      setSourceBadge(`Video: ${state.sourceName || "clip"}`);
      setDimensionsLabel(`Preview: ${formatDims(prepared.width, prepared.height)}`);
      syncVideoPreviewUI();
      state.lastVideoUiSyncAt = now;
    }
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
    syncVideoPreviewUI();
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
      TOOL.sourceVideo.playbackRate = currentSettings().playbackRate;
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
      stream = TOOL.previewCanvas.captureStream(60);
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
      state.suspendLivePreviewRender = true;
      state.lastVideoUiSyncAt = 0;
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

      recorder.start(1000);
      try {
        TOOL.sourceVideo.playbackRate = settings.playbackRate;
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
      state.suspendLivePreviewRender = false;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (wasPlaying && state.sourceType === "video") {
        try {
          TOOL.sourceVideo.playbackRate = currentSettings().playbackRate;
          await TOOL.sourceVideo.play();
          state.previewLoopActive = true;
          schedulePreviewTick();
        } catch {
          state.previewLoopActive = false;
        }
      }
      updateButtonStates();
      if (state.sourceType) {
        renderLivePreview(currentSettings());
      }
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
    if (TOOL.previewMode) TOOL.previewMode.value = "split";
    if (TOOL.previewBg) TOOL.previewBg.value = "checker";
    if (TOOL.previewZoom) TOOL.previewZoom.value = "100";
    if (TOOL.previewSplit) TOOL.previewSplit.value = "50";
    if (TOOL.subjectScale) TOOL.subjectScale.value = "100";
    if (TOOL.offsetX) TOOL.offsetX.value = "0";
    if (TOOL.offsetY) TOOL.offsetY.value = "0";
    if (TOOL.videoSeek) TOOL.videoSeek.value = "0";
    if (TOOL.playbackRate) TOOL.playbackRate.value = "100";
    if (TOOL.sourceVideo) TOOL.sourceVideo.playbackRate = 1;
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
        syncVideoPreviewUI();
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
        TOOL.sourceVideo.playbackRate = currentSettings().playbackRate;
        await renderCurrentPreview({ forceFreshMask: true });
        syncVideoPreviewUI();
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

  function onPreviewOnlyControlsChanged() {
    updateLabels();
    if (TOOL.sourceVideo && state.sourceType === "video") {
      TOOL.sourceVideo.playbackRate = currentSettings().playbackRate;
      syncVideoPreviewUI();
    }
    if (!state.sourceType) {
      drawLivePreviewPlaceholder();
      return;
    }
    renderLivePreview(currentSettings());
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
    TOOL.previewWrap = $("bgremoverPreviewWrap");
    TOOL.livePreviewCanvas = $("bgremoverLivePreviewCanvas");
    TOOL.previewMode = $("bgremoverPreviewMode");
    TOOL.previewBg = $("bgremoverPreviewBg");
    TOOL.previewZoom = $("bgremoverPreviewZoom");
    TOOL.previewZoomLabel = $("bgremoverPreviewZoomLabel");
    TOOL.previewSplitWrap = $("bgremoverPreviewSplitWrap");
    TOOL.previewSplit = $("bgremoverPreviewSplit");
    TOOL.previewSplitLabel = $("bgremoverPreviewSplitLabel");
    TOOL.subjectScale = $("bgremoverSubjectScale");
    TOOL.subjectScaleLabel = $("bgremoverSubjectScaleLabel");
    TOOL.offsetX = $("bgremoverOffsetX");
    TOOL.offsetXLabel = $("bgremoverOffsetXLabel");
    TOOL.offsetY = $("bgremoverOffsetY");
    TOOL.offsetYLabel = $("bgremoverOffsetYLabel");
    TOOL.videoControlsWrap = $("bgremoverVideoControlsWrap");
    TOOL.videoSeek = $("bgremoverVideoSeek");
    TOOL.videoSeekLabel = $("bgremoverVideoSeekLabel");
    TOOL.playbackRate = $("bgremoverPlaybackRate");
    TOOL.playbackRateLabel = $("bgremoverPlaybackRateLabel");
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

    const previewOnlyEls = [
      TOOL.previewMode,
      TOOL.previewBg,
      TOOL.previewZoom,
      TOOL.previewSplit,
      TOOL.subjectScale,
      TOOL.offsetX,
      TOOL.offsetY,
      TOOL.playbackRate,
    ];

    previewOnlyEls.forEach((el) => {
      if (!el) return;
      el.addEventListener("change", onPreviewOnlyControlsChanged);
      el.addEventListener("input", onPreviewOnlyControlsChanged);
    });

    if (TOOL.videoSeek) {
      TOOL.videoSeek.addEventListener("pointerdown", () => {
        state.isScrubbing = true;
      });
      TOOL.videoSeek.addEventListener("pointerup", async () => {
        state.isScrubbing = false;
        if (state.sourceType !== "video" || !TOOL.sourceVideo) return;
        const dur = TOOL.sourceVideo.duration;
        if (!Number.isFinite(dur) || dur <= 0) return;
        const pct = clamp(getNumeric(TOOL.videoSeek, 0), 0, 1000) / 1000;
        try {
          TOOL.sourceVideo.currentTime = pct * dur;
          await waitForEvent(TOOL.sourceVideo, "seeked", 800);
        } catch {
          // continue
        }
        renderCurrentPreview({ forceFreshMask: true });
      });
      TOOL.videoSeek.addEventListener("input", () => {
        if (state.sourceType !== "video" || !TOOL.sourceVideo) return;
        const dur = TOOL.sourceVideo.duration;
        if (!Number.isFinite(dur) || dur <= 0) return;
        const pct = clamp(getNumeric(TOOL.videoSeek, 0), 0, 1000) / 1000;
        const t = pct * dur;
        if (TOOL.videoSeekLabel) {
          TOOL.videoSeekLabel.textContent = `${formatClock(t)} / ${formatClock(dur)}`;
        }
      });
      TOOL.videoSeek.addEventListener("change", async () => {
        if (state.sourceType !== "video" || !TOOL.sourceVideo) return;
        const dur = TOOL.sourceVideo.duration;
        if (!Number.isFinite(dur) || dur <= 0) return;
        const pct = clamp(getNumeric(TOOL.videoSeek, 0), 0, 1000) / 1000;
        try {
          TOOL.sourceVideo.currentTime = pct * dur;
          await waitForEvent(TOOL.sourceVideo, "seeked", 800);
        } catch {
          // continue
        }
        state.isScrubbing = false;
        renderCurrentPreview({ forceFreshMask: true });
      });
    }

    if (TOOL.sourceVideo) {
      TOOL.sourceVideo.addEventListener("play", () => {
        state.previewLoopActive = true;
        updateButtonStates();
        schedulePreviewTick();
        syncVideoPreviewUI();
      });
      TOOL.sourceVideo.addEventListener("pause", () => {
        if (!state.recording) {
          state.previewLoopActive = false;
          updateButtonStates();
        }
        syncVideoPreviewUI();
      });
      TOOL.sourceVideo.addEventListener("ended", () => {
        if (!state.recording) {
          state.previewLoopActive = false;
          updateButtonStates();
        }
        syncVideoPreviewUI();
      });
      TOOL.sourceVideo.addEventListener("seeked", () => {
        if (!state.previewLoopActive && state.sourceType === "video") {
          renderCurrentPreview({ forceFreshMask: true });
        }
        syncVideoPreviewUI();
      });
      TOOL.sourceVideo.addEventListener("timeupdate", () => {
        syncVideoPreviewUI();
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
    syncVideoPreviewUI();
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
