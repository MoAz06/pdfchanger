import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

const { PDFDocument, StandardFonts, rgb } = PDFLib;

const state = {
  originalBytes: null,
  pdfJsDoc: null,
  currentPageViewIndex: 0,
  pageOrder: [],
  pageOverlays: {},
  selectedTool: "select",
  selectedObjectId: null,
  dragState: null,
  scale: 1.2,
  fileName: "document.pdf",
};

const el = {
  pdfFile: document.getElementById("pdfFile"),
  exportBtn: document.getElementById("exportBtn"),
  status: document.getElementById("status"),
  pageInfo: document.getElementById("pageInfo"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  pdfCanvas: document.getElementById("pdfCanvas"),
  overlayLayer: document.getElementById("overlayLayer"),
  canvasWrap: document.getElementById("canvasWrap"),
  pageList: document.getElementById("pageList"),
  textValue: document.getElementById("textValue"),
  fontSize: document.getElementById("fontSize"),
  whiteoutOpacity: document.getElementById("whiteoutOpacity"),
  deleteObjectBtn: document.getElementById("deleteObjectBtn"),
  toolButtons: [...document.querySelectorAll(".tool-btn")],
};

function setStatus(msg) {
  el.status.textContent = msg;
}

function getCurrentLogicalPage() {
  return state.pageOrder[state.currentPageViewIndex];
}

function getOverlaysForCurrentPage() {
  const logicalPage = getCurrentLogicalPage();
  if (!state.pageOverlays[logicalPage]) state.pageOverlays[logicalPage] = [];
  return state.pageOverlays[logicalPage];
}

function setSelectedTool(tool) {
  state.selectedTool = tool;
  el.toolButtons.forEach((b) => b.classList.toggle("active", b.dataset.tool === tool));
}

function clearSelection() {
  state.selectedObjectId = null;
  el.textValue.value = "";
  el.deleteObjectBtn.disabled = true;
  renderOverlayDom();
}

function selectObject(id) {
  state.selectedObjectId = id;
  const obj = getOverlaysForCurrentPage().find((item) => item.id === id);
  el.deleteObjectBtn.disabled = !obj;
  if (!obj) return;
  if (obj.type === "text") {
    el.textValue.value = obj.text;
    el.fontSize.value = obj.fontSize;
  }
  if (obj.type === "whiteout") {
    el.whiteoutOpacity.value = obj.opacity ?? 1;
  }
  renderOverlayDom();
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

async function loadPdf(file) {
  state.fileName = file.name;
  state.originalBytes = await file.arrayBuffer();
  state.pdfJsDoc = await pdfjsLib.getDocument({ data: state.originalBytes }).promise;
  state.pageOrder = Array.from({ length: state.pdfJsDoc.numPages }, (_, i) => i + 1);
  state.pageOverlays = {};
  state.currentPageViewIndex = 0;
  clearSelection();
  await renderPage();
  await renderPageList();
  el.exportBtn.disabled = false;
  el.prevPageBtn.disabled = false;
  el.nextPageBtn.disabled = false;
  setStatus("PDF loaded.");
}

async function renderPage() {
  if (!state.pdfJsDoc) return;
  const logicalPage = getCurrentLogicalPage();
  const page = await state.pdfJsDoc.getPage(logicalPage);
  const viewport = page.getViewport({ scale: state.scale });

  const ctx = el.pdfCanvas.getContext("2d");
  el.pdfCanvas.width = viewport.width;
  el.pdfCanvas.height = viewport.height;

  el.overlayLayer.style.width = `${viewport.width}px`;
  el.overlayLayer.style.height = `${viewport.height}px`;

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  el.pageInfo.textContent = `Page ${state.currentPageViewIndex + 1} of ${state.pageOrder.length} (source page ${logicalPage})`;
  renderOverlayDom();
}

function renderOverlayDom() {
  const overlays = getOverlaysForCurrentPage();
  el.overlayLayer.innerHTML = "";

  overlays.forEach((obj) => {
    const node = document.createElement("div");
    node.className = `overlay-object ${obj.type === "text" ? "overlay-text" : "overlay-whiteout"}`;
    if (state.selectedObjectId === obj.id) node.classList.add("selected");

    node.style.left = `${obj.x * state.scale}px`;
    node.style.top = `${obj.y * state.scale}px`;
    node.style.width = `${obj.width * state.scale}px`;
    node.style.height = `${obj.height * state.scale}px`;

    node.dataset.id = obj.id;

    if (obj.type === "text") {
      node.textContent = obj.text;
      node.style.fontSize = `${obj.fontSize * state.scale}px`;
      node.style.lineHeight = "1.2";
      node.style.background = "transparent";
    } else {
      node.style.opacity = obj.opacity ?? 1;
    }

    node.addEventListener("pointerdown", (e) => startDragObject(e, obj.id, "move"));
    node.addEventListener("click", (e) => {
      e.stopPropagation();
      selectObject(obj.id);
    });

    if (state.selectedObjectId === obj.id) {
      const handle = document.createElement("div");
      handle.className = "resize-handle";
      handle.addEventListener("pointerdown", (e) => startDragObject(e, obj.id, "resize"));
      node.appendChild(handle);
    }

    el.overlayLayer.appendChild(node);
  });
}

function startDragObject(e, id, mode) {
  e.stopPropagation();
  const obj = getOverlaysForCurrentPage().find((item) => item.id === id);
  if (!obj) return;
  selectObject(id);
  state.dragState = {
    kind: "object",
    mode,
    id,
    startX: e.clientX,
    startY: e.clientY,
    objStartX: obj.x,
    objStartY: obj.y,
    objStartW: obj.width,
    objStartH: obj.height,
  };
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}

function startCreateObject(clientX, clientY) {
  const rect = el.overlayLayer.getBoundingClientRect();
  const x = (clientX - rect.left) / state.scale;
  const y = (clientY - rect.top) / state.scale;

  const obj =
    state.selectedTool === "text"
      ? {
          id: uid(),
          type: "text",
          x,
          y,
          width: 160,
          height: 28,
          text: "New text",
          fontSize: Number(el.fontSize.value) || 18,
        }
      : {
          id: uid(),
          type: "whiteout",
          x,
          y,
          width: 140,
          height: 40,
          opacity: Number(el.whiteoutOpacity.value) || 1,
        };

  getOverlaysForCurrentPage().push(obj);
  selectObject(obj.id);
  renderOverlayDom();
}

function onPointerMove(e) {
  const ds = state.dragState;
  if (!ds || ds.kind !== "object") return;
  const overlays = getOverlaysForCurrentPage();
  const obj = overlays.find((item) => item.id === ds.id);
  if (!obj) return;

  const dx = (e.clientX - ds.startX) / state.scale;
  const dy = (e.clientY - ds.startY) / state.scale;

  if (ds.mode === "move") {
    obj.x = Math.max(0, ds.objStartX + dx);
    obj.y = Math.max(0, ds.objStartY + dy);
  } else {
    obj.width = Math.max(20, ds.objStartW + dx);
    obj.height = Math.max(20, ds.objStartH + dy);
  }
  renderOverlayDom();
}

function onPointerUp() {
  state.dragState = null;
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
}

function attachEvents() {
  el.pdfFile.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") {
      setStatus("Please upload a valid PDF.");
      return;
    }
    try {
      await loadPdf(file);
    } catch (err) {
      console.error(err);
      setStatus("Failed to load PDF.");
    }
  });

  el.toolButtons.forEach((btn) => {
    btn.addEventListener("click", () => setSelectedTool(btn.dataset.tool));
  });

  el.overlayLayer.addEventListener("click", (e) => {
    if (!state.pdfJsDoc) return;
    if (e.target !== el.overlayLayer) return;
    if (state.selectedTool === "select") {
      clearSelection();
      return;
    }
    startCreateObject(e.clientX, e.clientY);
  });

  el.textValue.addEventListener("input", () => {
    const obj = getOverlaysForCurrentPage().find((item) => item.id === state.selectedObjectId);
    if (!obj || obj.type !== "text") return;
    obj.text = el.textValue.value;
    renderOverlayDom();
  });

  el.fontSize.addEventListener("input", () => {
    const obj = getOverlaysForCurrentPage().find((item) => item.id === state.selectedObjectId);
    if (!obj || obj.type !== "text") return;
    obj.fontSize = Number(el.fontSize.value) || 18;
    renderOverlayDom();
  });

  el.whiteoutOpacity.addEventListener("input", () => {
    const obj = getOverlaysForCurrentPage().find((item) => item.id === state.selectedObjectId);
    if (!obj || obj.type !== "whiteout") return;
    obj.opacity = Number(el.whiteoutOpacity.value) || 1;
    renderOverlayDom();
  });

  el.deleteObjectBtn.addEventListener("click", () => {
    const overlays = getOverlaysForCurrentPage();
    const idx = overlays.findIndex((item) => item.id === state.selectedObjectId);
    if (idx === -1) return;
    overlays.splice(idx, 1);
    clearSelection();
  });

  el.prevPageBtn.addEventListener("click", async () => {
    if (state.currentPageViewIndex > 0) {
      state.currentPageViewIndex -= 1;
      clearSelection();
      await renderPage();
      highlightActivePageItem();
    }
  });

  el.nextPageBtn.addEventListener("click", async () => {
    if (state.currentPageViewIndex < state.pageOrder.length - 1) {
      state.currentPageViewIndex += 1;
      clearSelection();
      await renderPage();
      highlightActivePageItem();
    }
  });

  el.exportBtn.addEventListener("click", exportPdf);
}

async function renderPageList() {
  el.pageList.innerHTML = "";
  for (let viewIndex = 0; viewIndex < state.pageOrder.length; viewIndex++) {
    const logicalPage = state.pageOrder[viewIndex];
    const page = await state.pdfJsDoc.getPage(logicalPage);
    const viewport = page.getViewport({ scale: 0.2 });

    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = viewport.width;
    thumbCanvas.height = viewport.height;
    await page.render({
      canvasContext: thumbCanvas.getContext("2d"),
      viewport,
    }).promise;

    const item = document.createElement("div");
    item.className = "page-item";
    item.draggable = true;
    item.dataset.viewIndex = String(viewIndex);

    const img = document.createElement("img");
    img.className = "page-thumb";
    img.src = thumbCanvas.toDataURL("image/png");

    const meta = document.createElement("div");
    meta.className = "page-meta";
    meta.innerHTML = `<strong>Page ${viewIndex + 1}</strong><span>Source page ${logicalPage}</span>`;

    item.appendChild(img);
    item.appendChild(meta);

    item.addEventListener("click", async () => {
      state.currentPageViewIndex = viewIndex;
      clearSelection();
      await renderPage();
      highlightActivePageItem();
    });

    item.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", String(viewIndex));
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    item.addEventListener("drop", async (e) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData("text/plain"));
      const to = viewIndex;
      if (Number.isNaN(from) || from === to) return;

      const movedPage = state.pageOrder.splice(from, 1)[0];
      state.pageOrder.splice(to, 0, movedPage);

      const movedCurrent = state.currentPageViewIndex === from;
      if (movedCurrent) {
        state.currentPageViewIndex = to;
      } else if (from < state.currentPageViewIndex && to >= state.currentPageViewIndex) {
        state.currentPageViewIndex -= 1;
      } else if (from > state.currentPageViewIndex && to <= state.currentPageViewIndex) {
        state.currentPageViewIndex += 1;
      }

      await renderPageList();
      await renderPage();
      setStatus("Page order updated.");
    });

    el.pageList.appendChild(item);
  }
  highlightActivePageItem();
}

function highlightActivePageItem() {
  [...el.pageList.children].forEach((child, idx) => {
    child.classList.toggle("active", idx === state.currentPageViewIndex);
  });
}

async function exportPdf() {
  if (!state.originalBytes) return;

  try {
    const srcPdf = await PDFDocument.load(state.originalBytes);
    const outPdf = await PDFDocument.create();
    const helvetica = await outPdf.embedFont(StandardFonts.Helvetica);

    for (let viewIndex = 0; viewIndex < state.pageOrder.length; viewIndex++) {
      const logicalPage = state.pageOrder[viewIndex];
      const [copiedPage] = await outPdf.copyPages(srcPdf, [logicalPage - 1]);
      const newPage = outPdf.addPage(copiedPage);

      const overlays = state.pageOverlays[logicalPage] || [];
      const pageHeight = newPage.getHeight();

      for (const obj of overlays) {
        const yFromBottom = pageHeight - obj.y - obj.height;

        if (obj.type === "whiteout") {
          newPage.drawRectangle({
            x: obj.x,
            y: yFromBottom,
            width: obj.width,
            height: obj.height,
            color: rgb(1, 1, 1),
            opacity: obj.opacity ?? 1,
            borderWidth: 0,
          });
        }

        if (obj.type === "text") {
          const lineHeight = obj.fontSize * 1.2;
          const lines = obj.text.split("\\n");
          lines.forEach((line, i) => {
            newPage.drawText(line, {
              x: obj.x,
              y: pageHeight - obj.y - obj.fontSize - i * lineHeight,
              size: obj.fontSize,
              font: helvetica,
              color: rgb(0, 0, 0),
              maxWidth: obj.width,
            });
          });
        }
      }
    }

    const bytes = await outPdf.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `edited-${state.fileName}`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Export complete.");
  } catch (err) {
    console.error(err);
    setStatus("Export failed.");
  }
}

attachEvents();
setSelectedTool("select");
