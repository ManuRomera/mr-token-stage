const MODULE_ID = "mr-token-stage";
const VERSION = "1.0.1";

const BUILTIN_PRESETS = {
  normal: { label: "Normal", icon: "fa-circle", scaleX: 1, scaleY: 1, alpha: 1, offsetX: 0, offsetY: 0, textureRotation: 0 },
  tiny: { label: "Minúsculo", icon: "fa-compress", scaleX: 0.25, scaleY: 0.25 },
  small: { label: "Pequeño", icon: "fa-down-left-and-up-right-to-center", scaleX: 0.5, scaleY: 0.5 },
  large: { label: "Grande", icon: "fa-up-right-and-down-left-from-center", scaleX: 1.5, scaleY: 1.5 },
  huge: { label: "Enorme", icon: "fa-expand", scaleX: 2, scaleY: 2 },
  giant: { label: "Gigante", icon: "fa-maximize", scaleX: 3, scaleY: 3 },
  colossal: { label: "Colosal", icon: "fa-arrows-up-down-left-right", scaleX: 5, scaleY: 5 },
  cinematic: { label: "Cinemático", icon: "fa-film", scaleX: 8, scaleY: 8 },
  ghost: { label: "Fantasma", icon: "fa-ghost", scaleX: 1.15, scaleY: 1.15, alpha: 0.42 },
  boss: { label: "Boss", icon: "fa-crown", scaleX: 1.6, scaleY: 1.6, alpha: 1 }
};

const runtime = {
  clipboard: null,
  undo: [],
  focus: new Map(),
  spotlight: new Map(),
  app: null,
  originalRulerVisible: null
};

function notify(key, type = "info") {
  ui.notifications?.[type]?.(game.i18n.localize(key));
}

function selectedTokens({ silent = false } = {}) {
  const tokens = canvas?.tokens?.controlled ?? [];
  if (!tokens.length && !silent) notify("MRTS.NoTokens", "warn");
  return tokens;
}

function canUse(token) {
  if (game.user.isGM) return true;
  if (!game.settings.get(MODULE_ID, "allowPlayers")) return false;
  return token?.document?.isOwner ?? false;
}

function textureData(doc) {
  const t = doc.texture ?? {};
  return {
    scaleX: Number(t.scaleX ?? 1),
    scaleY: Number(t.scaleY ?? 1),
    offsetX: Number(t.offsetX ?? 0),
    offsetY: Number(t.offsetY ?? 0),
    rotation: Number(t.rotation ?? 0),
    tint: t.tint ?? null
  };
}

function snapshotDocument(doc) {
  const t = textureData(doc);
  return {
    _id: doc.id,
    width: doc.width,
    height: doc.height,
    alpha: doc.alpha ?? 1,
    rotation: doc.rotation ?? 0,
    lockRotation: doc.lockRotation ?? false,
    displayName: doc.displayName,
    displayBars: doc.displayBars,
    texture: { ...t }
  };
}

function appearanceUpdate(snapshot) {
  return {
    _id: snapshot._id,
    width: snapshot.width,
    height: snapshot.height,
    alpha: snapshot.alpha,
    rotation: snapshot.rotation,
    lockRotation: snapshot.lockRotation,
    displayName: snapshot.displayName,
    displayBars: snapshot.displayBars,
    "texture.scaleX": snapshot.texture.scaleX,
    "texture.scaleY": snapshot.texture.scaleY,
    "texture.offsetX": snapshot.texture.offsetX,
    "texture.offsetY": snapshot.texture.offsetY,
    "texture.rotation": snapshot.texture.rotation,
    "texture.tint": snapshot.texture.tint
  };
}

function pushUndo(label, docs) {
  runtime.undo.push({
    label,
    sceneId: canvas.scene?.id,
    states: docs.map(snapshotDocument),
    ts: Date.now()
  });
  if (runtime.undo.length > 30) runtime.undo.shift();
}

async function batchUpdate(tokens, makeUpdate, { label = "MR Token Stage", remember = true } = {}) {
  const usable = tokens.filter(canUse);
  if (!usable.length) return;
  if (remember) pushUndo(label, usable.map(t => t.document));
  const updates = usable.map((token, index) => ({ _id: token.document.id, ...makeUpdate(token.document, token, index) }));
  if (updates.length) await canvas.scene.updateEmbeddedDocuments("Token", updates, { diff: true });
}

async function undo() {
  const last = runtime.undo.pop();
  if (!last) return notify("MRTS.NoUndo", "warn");
  if (last.sceneId !== canvas.scene?.id) {
    runtime.undo.push(last);
    return ui.notifications.warn("MR Token Stage: el último cambio pertenece a otra escena.");
  }
  await canvas.scene.updateEmbeddedDocuments("Token", last.states.map(appearanceUpdate));
  notify("MRTS.Undone");
}

async function scale(value, { relative = false, preserveRatio = true } = {}) {
  const tokens = selectedTokens();
  if (!tokens.length) return;
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return ui.notifications.warn("MR Token Stage: escala no válida.");
  await batchUpdate(tokens, doc => {
    const t = textureData(doc);
    const sx = relative ? t.scaleX * n : Math.sign(t.scaleX || 1) * Math.abs(n);
    const sy = relative ? t.scaleY * n : (preserveRatio ? Math.sign(t.scaleY || 1) * Math.abs(n) : t.scaleY);
    return { "texture.scaleX": sx, "texture.scaleY": sy };
  }, { label: relative ? `Escala relativa ×${n}` : `Escala ×${n}` });
}

async function offset(x, y) {
  const tokens = selectedTokens(); if (!tokens.length) return;
  await batchUpdate(tokens, () => ({ "texture.offsetX": Number(x) || 0, "texture.offsetY": Number(y) || 0 }), { label: "Offset" });
}

async function rotateTexture(deg) {
  const tokens = selectedTokens(); if (!tokens.length) return;
  await batchUpdate(tokens, () => ({ "texture.rotation": Number(deg) || 0 }), { label: "Rotación visual" });
}

async function opacity(alpha) {
  const tokens = selectedTokens(); if (!tokens.length) return;
  const a = Math.max(0, Math.min(1, Number(alpha)));
  await batchUpdate(tokens, () => ({ alpha: a }), { label: "Opacidad" });
}

async function flip(axis = "x") {
  const tokens = selectedTokens(); if (!tokens.length) return;
  await batchUpdate(tokens, doc => {
    const t = textureData(doc);
    return axis === "y" ? { "texture.scaleY": -t.scaleY } : { "texture.scaleX": -t.scaleX };
  }, { label: `Flip ${axis.toUpperCase()}` });
}

async function fit() {
  const tokens = selectedTokens(); if (!tokens.length) return;
  await batchUpdate(tokens, () => ({
    "texture.scaleX": 1, "texture.scaleY": 1,
    "texture.offsetX": 0, "texture.offsetY": 0,
    "texture.rotation": 0
  }), { label: "Auto fit" });
}

async function copyAppearance() {
  const tokens = selectedTokens(); if (!tokens.length) return;
  runtime.clipboard = snapshotDocument(tokens[0].document);
  notify("MRTS.Copied");
}

async function pasteAppearance() {
  if (!runtime.clipboard) return notify("MRTS.NoClipboard", "warn");
  const tokens = selectedTokens(); if (!tokens.length) return;
  const src = runtime.clipboard;
  await batchUpdate(tokens, doc => {
    const u = appearanceUpdate({ ...src, _id: doc.id }); delete u._id; return u;
  }, { label: "Pegar apariencia" });
}

async function equalize(mode = "scale") {
  const tokens = selectedTokens(); if (tokens.length < 2) return;
  const first = tokens[0].document;
  const t = textureData(first);
  await batchUpdate(tokens, () => mode === "base"
    ? { width: first.width, height: first.height }
    : { "texture.scaleX": t.scaleX, "texture.scaleY": t.scaleY }, { label: "Igualar tokens" });
}

async function humanize(amount = 0.1) {
  const tokens = selectedTokens(); if (!tokens.length) return;
  const variance = Math.max(0, Math.min(0.5, Number(amount) || 0.1));
  await batchUpdate(tokens, doc => {
    const t = textureData(doc);
    const factor = 1 + ((Math.random() * 2 - 1) * variance);
    const flipX = Math.random() < 0.5 ? -1 : 1;
    const angle = (Math.random() * 6) - 3;
    return {
      "texture.scaleX": Math.abs(t.scaleX) * factor * flipX,
      "texture.scaleY": Math.abs(t.scaleY) * factor,
      "texture.rotation": (t.rotation ?? 0) + angle
    };
  }, { label: "Humanizar grupo" });
}

async function applyPreset(idOrPreset) {
  const preset = typeof idOrPreset === "string" ? getPresets()[idOrPreset] : idOrPreset;
  if (!preset) return;
  const tokens = selectedTokens(); if (!tokens.length) return;
  await batchUpdate(tokens, doc => {
    const t = textureData(doc);
    const update = {};
    if (preset.scaleX != null) update["texture.scaleX"] = Math.sign(t.scaleX || 1) * Math.abs(Number(preset.scaleX));
    if (preset.scaleY != null) update["texture.scaleY"] = Math.sign(t.scaleY || 1) * Math.abs(Number(preset.scaleY));
    if (preset.offsetX != null) update["texture.offsetX"] = Number(preset.offsetX);
    if (preset.offsetY != null) update["texture.offsetY"] = Number(preset.offsetY);
    if (preset.textureRotation != null) update["texture.rotation"] = Number(preset.textureRotation);
    if (preset.alpha != null) update.alpha = Number(preset.alpha);
    if (preset.tint !== undefined) update["texture.tint"] = preset.tint;
    if (preset.width != null) update.width = Number(preset.width);
    if (preset.height != null) update.height = Number(preset.height);
    if (preset.lockRotation != null) update.lockRotation = !!preset.lockRotation;
    return update;
  }, { label: `Preset ${preset.label ?? ""}`.trim() });
}

function getPresets() {
  return { ...BUILTIN_PRESETS, ...(game.settings.get(MODULE_ID, "customPresets") || {}) };
}

async function savePreset(name) {
  const tokens = selectedTokens(); if (!tokens.length || !name?.trim()) return;
  const s = snapshotDocument(tokens[0].document);
  const key = name.trim().toLowerCase().replace(/[^a-z0-9áéíóúüñ_-]+/gi, "-");
  const custom = foundry.utils.deepClone(game.settings.get(MODULE_ID, "customPresets") || {});
  custom[key] = {
    label: name.trim(), icon: "fa-star",
    scaleX: s.texture.scaleX, scaleY: s.texture.scaleY,
    offsetX: s.texture.offsetX, offsetY: s.texture.offsetY,
    textureRotation: s.texture.rotation,
    alpha: s.alpha, tint: s.texture.tint,
    width: s.width, height: s.height, lockRotation: s.lockRotation
  };
  await game.settings.set(MODULE_ID, "customPresets", custom);
  runtime.app?.render(true);
}

async function restoreOriginal() {
  const tokens = selectedTokens(); if (!tokens.length) return;
  const updates = [];
  for (const token of tokens.filter(canUse)) {
    const original = token.document.getFlag(MODULE_ID, "originalAppearance");
    if (original) updates.push(appearanceUpdate({ ...original, _id: token.document.id }));
  }
  if (!updates.length) return ui.notifications.warn("MR Token Stage: no hay un estado original guardado para la selección.");
  pushUndo("Antes de restaurar", tokens.map(t => t.document));
  await canvas.scene.updateEmbeddedDocuments("Token", updates);
  notify("MRTS.Restored");
}

async function rememberOriginals(tokens) {
  for (const token of tokens) {
    if (!token.document.getFlag(MODULE_ID, "originalAppearance")) {
      await token.document.setFlag(MODULE_ID, "originalAppearance", snapshotDocument(token.document));
    }
  }
}

function clearFocus() {
  for (const [id, alpha] of runtime.focus.entries()) {
    const token = canvas.tokens?.get(id);
    if (token) token.alpha = alpha;
  }
  runtime.focus.clear();
  for (const [id, graphic] of runtime.spotlight.entries()) {
    try { graphic.destroy({ children: true }); } catch (_) {}
    runtime.spotlight.delete(id);
  }
}

function focusSelected({ spotlight = false } = {}) {
  const selected = selectedTokens(); if (!selected.length) return;
  clearFocus();
  const ids = new Set(selected.map(t => t.id));
  for (const token of canvas.tokens.placeables) {
    runtime.focus.set(token.id, token.alpha);
    token.alpha = ids.has(token.id) ? 1 : 0.28;
  }
  if (spotlight && globalThis.PIXI) {
    for (const token of selected) {
      const g = new PIXI.Graphics();
      const radius = Math.max(token.w, token.h) * 0.62;
      try {
        g.circle?.(token.center.x, token.center.y, radius)?.stroke?.({ width: 5, color: 0xffffff, alpha: 0.85 });
        if (!g.circle) {
          g.lineStyle(5, 0xffffff, 0.85);
          g.drawCircle(token.center.x, token.center.y, radius);
        }
        canvas.tokens.addChild(g);
        runtime.spotlight.set(token.id, g);
      } catch (_) {}
    }
  }
}

async function scenicMode() {
  const tokens = selectedTokens(); if (!tokens.length) return;
  const NONE = CONST.TOKEN_DISPLAY_MODES.NONE;
  await rememberOriginals(tokens);
  await batchUpdate(tokens, () => ({
    width: 1, height: 1, displayName: NONE, displayBars: NONE,
    lockRotation: true
  }), { label: "Token escénico" });
}

function registerSettings() {
  const clientBool = (key, def) => game.settings.register(MODULE_ID, key, {
    name: `MRTS.Settings.${key[0].toUpperCase()+key.slice(1)}.Name`,
    hint: `MRTS.Settings.${key[0].toUpperCase()+key.slice(1)}.Hint`, scope: "client", config: true, type: Boolean, default: def,
    onChange: () => runtime.app?.render(false)
  });

  game.settings.register(MODULE_ID, "suppressRuler", {
    name: "MRTS.Settings.SuppressRuler.Name", hint: "MRTS.Settings.SuppressRuler.Hint",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "preserveFacing", {
    name: "MRTS.Settings.PreserveFacing.Name", hint: "MRTS.Settings.PreserveFacing.Hint",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "allowPlayers", {
    name: "MRTS.Settings.AllowPlayers.Name", hint: "MRTS.Settings.AllowPlayers.Hint",
    scope: "world", config: true, type: Boolean, default: true
  });
  clientBool("tooltips", true);
  clientBool("reducedMotion", false);
  clientBool("largeUI", false);
  clientBool("highContrast", false);
  game.settings.register(MODULE_ID, "panelState", { scope: "client", config: false, type: Object, default: {} });
  game.settings.register(MODULE_ID, "customPresets", { scope: "world", config: false, type: Object, default: {} });
}

function installRulerSuppression() {
  try {
    const rulerClass = CONFIG.Token?.rulerClass;
    if (!rulerClass?.prototype) return;
    let proto = rulerClass.prototype;
    let descriptor;
    while (proto && !descriptor) {
      descriptor = Object.getOwnPropertyDescriptor(proto, "isVisible");
      if (!descriptor) proto = Object.getPrototypeOf(proto);
    }
    if (!proto || !descriptor?.get || proto.__mrTokenStageRulerPatched) return;
    const originalGet = descriptor.get;
    Object.defineProperty(proto, "isVisible", {
      configurable: true,
      get() {
        try {
          if (game?.settings?.get(MODULE_ID, "suppressRuler")) return false;
        } catch (_) {}
        return originalGet.call(this);
      }
    });
    Object.defineProperty(proto, "__mrTokenStageRulerPatched", { value: true, configurable: true });
  } catch (err) {
    console.warn(`${MODULE_ID} | Could not patch token ruler visibility`, err);
  }
}

function installMovementFacingProtection() {
  Hooks.on("preUpdateToken", (doc, changes, options, userId) => {
    if (!game.settings.get(MODULE_ID, "preserveFacing")) return;
    const moved = Object.hasOwn(changes, "x") || Object.hasOwn(changes, "y") || Object.hasOwn(changes, "elevation");
    if (moved && Object.hasOwn(changes, "rotation")) delete changes.rotation;
  });
  Hooks.on("preCreateToken", (doc) => {
    if (!game.settings.get(MODULE_ID, "preserveFacing")) return;
    doc.updateSource({ lockRotation: true });
  });
}

const LegacyApplication = globalThis.Application ?? foundry.appv1?.api?.Application;

class MRTokenStageApp extends LegacyApplication {
  static get defaultOptions() {
    const state = game?.settings?.get(MODULE_ID, "panelState") || {};
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "mr-token-stage-panel",
      title: "MR Token Stage",
      classes: ["mr-token-stage"],
      width: state.width || 390,
      height: state.height || "auto",
      top: state.top,
      left: state.left,
      resizable: true,
      minimizable: true,
      popOut: true
    });
  }

  async _renderInner() {
    const first = selectedTokens({ silent: true })[0]?.document;
    const t = first ? textureData(first) : { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, rotation: 0 };
    const alpha = first?.alpha ?? 1;
    const presets = getPresets();
    const tip = game.settings.get(MODULE_ID, "tooltips");
    const title = s => tip ? ` title="${s.replaceAll('"','&quot;')}"` : "";
    return $(`
      <div class="mrts-shell ${game.settings.get(MODULE_ID,"largeUI") ? "mrts-large" : ""} ${game.settings.get(MODULE_ID,"highContrast") ? "mrts-contrast" : ""}">
        <header class="mrts-hero">
          <img src="modules/${MODULE_ID}/assets/logo.svg" alt=""/>
          <div><h2>MR Token Stage</h2><p>Scale · Style · Focus · Perform</p></div>
          <span class="mrts-selection">${canvas?.tokens?.controlled?.length ?? 0} token(s)</span>
        </header>

        <section class="mrts-card">
          <div class="mrts-card-title"><i class="fa-solid fa-up-right-and-down-left-from-center"></i> Escala visual</div>
          <div class="mrts-scale-row">
            <button data-action="scale-step" data-delta="0.9"${title("Reduce un 10% manteniendo las diferencias entre tokens.")}><i class="fa-solid fa-minus"></i></button>
            <input name="scale" type="number" min="0.05" max="20" step="0.05" value="${Math.abs(t.scaleX).toFixed(2)}" aria-label="Escala visual"/>
            <button data-action="scale-step" data-delta="1.1"${title("Aumenta un 10% manteniendo las diferencias entre tokens.")}><i class="fa-solid fa-plus"></i></button>
          </div>
          <input class="mrts-range" name="scaleRange" type="range" min="0.1" max="8" step="0.1" value="${Math.min(8,Math.abs(t.scaleX))}"/>
          <div class="mrts-pills">
            ${[0.25,0.5,1,1.5,2,3,5,8].map(v=>`<button data-action="scale" data-value="${v}">×${v}</button>`).join("")}
          </div>
        </section>

        <section class="mrts-grid2">
          <div class="mrts-card">
            <div class="mrts-card-title"><i class="fa-solid fa-arrows-left-right-to-line"></i> Imagen</div>
            <div class="mrts-fields">
              <label>X <input name="offsetX" type="number" step="1" value="${t.offsetX}"></label>
              <label>Y <input name="offsetY" type="number" step="1" value="${t.offsetY}"></label>
              <label>° <input name="textureRotation" type="number" step="1" value="${t.rotation}"></label>
              <label>α <input name="alpha" type="number" min="0" max="1" step="0.05" value="${alpha}"></label>
            </div>
            <div class="mrts-actions">
              <button data-action="apply-image"${title("Aplica offset, rotación visual y opacidad sin mover la peana.")}><i class="fa-solid fa-check"></i> Aplicar</button>
              <button data-action="fit"${title("Restablece encuadre visual: escala 1, offsets 0 y rotación visual 0.")}><i class="fa-solid fa-crosshairs"></i> Ajustar</button>
            </div>
          </div>
          <div class="mrts-card">
            <div class="mrts-card-title"><i class="fa-solid fa-wand-magic-sparkles"></i> Acciones</div>
            <div class="mrts-icon-grid">
              <button data-action="flip-x"${title("Voltear horizontalmente.")}><i class="fa-solid fa-left-right"></i><span>Flip X</span></button>
              <button data-action="flip-y"${title("Voltear verticalmente.")}><i class="fa-solid fa-up-down"></i><span>Flip Y</span></button>
              <button data-action="humanize"${title("Varía escala, flip y unos grados de rotación para romper el efecto clon.")}><i class="fa-solid fa-people-group"></i><span>Humanizar</span></button>
              <button data-action="scenic"${title("Peana 1×1, nombre y barras ocultos y rotación bloqueada. Guarda el estado previo.")}><i class="fa-solid fa-masks-theater"></i><span>Escénico</span></button>
            </div>
          </div>
        </section>

        <section class="mrts-card">
          <div class="mrts-card-title"><i class="fa-solid fa-bullseye"></i> Dirección de escena</div>
          <div class="mrts-actions mrts-wide-actions">
            <button data-action="focus"${title("Atenúa temporalmente el resto de tokens para dirigir la atención.")}><i class="fa-solid fa-eye"></i> Focus</button>
            <button data-action="spotlight"${title("Focus con anillo visual alrededor de la selección.")}><i class="fa-solid fa-sun"></i> Spotlight</button>
            <button data-action="clear-focus"><i class="fa-solid fa-eye-slash"></i> Limpiar</button>
          </div>
        </section>

        <section class="mrts-card">
          <div class="mrts-card-title"><i class="fa-solid fa-bookmark"></i> Presets</div>
          <div class="mrts-presets">
            ${Object.entries(presets).map(([id,p])=>`<button data-action="preset" data-preset="${id}"${title(`Aplicar preset ${p.label}.`)}><i class="fa-solid ${p.icon || "fa-star"}"></i><span>${p.label}</span></button>`).join("")}
          </div>
          <div class="mrts-save-preset"><input name="presetName" type="text" placeholder="Nombre del nuevo preset"><button data-action="save-preset"><i class="fa-solid fa-floppy-disk"></i></button></div>
        </section>

        <section class="mrts-card mrts-footer-tools">
          <button data-action="copy"${title("Copia sólo apariencia visual y tamaño, no actor ni posición.")}><i class="fa-regular fa-copy"></i> Copiar</button>
          <button data-action="paste"><i class="fa-regular fa-paste"></i> Pegar</button>
          <button data-action="equalize"><i class="fa-solid fa-equals"></i> Igualar</button>
          <button data-action="undo"><i class="fa-solid fa-rotate-left"></i> Deshacer</button>
          <button data-action="restore"><i class="fa-solid fa-clock-rotate-left"></i> Original</button>
        </section>

        <footer class="mrts-status">
          <span><i class="fa-solid fa-route"></i> Regla al mover: <strong>${game.settings.get(MODULE_ID,"suppressRuler") ? "oculta" : "visible"}</strong></span>
          <span><i class="fa-solid fa-compass"></i> Orientación: <strong>${game.settings.get(MODULE_ID,"preserveFacing") ? "fija" : "Foundry"}</strong></span>
        </footer>
      </div>
    `);
  }

  activateListeners(html) {
    super.activateListeners(html);
    const root = html[0];
    const val = n => root.querySelector(`[name="${n}"]`)?.value;
    const rerender = () => this.render(false);
    root.addEventListener("click", async ev => {
      const btn = ev.target.closest("button[data-action]"); if (!btn) return;
      ev.preventDefault();
      const a = btn.dataset.action;
      if (a === "scale") await scale(btn.dataset.value);
      else if (a === "scale-step") await scale(btn.dataset.delta, { relative: true });
      else if (a === "apply-image") {
        const tokens = selectedTokens(); if (tokens.length) await batchUpdate(tokens, () => ({
          "texture.offsetX": Number(val("offsetX")) || 0,
          "texture.offsetY": Number(val("offsetY")) || 0,
          "texture.rotation": Number(val("textureRotation")) || 0,
          alpha: Math.max(0, Math.min(1, Number(val("alpha"))))
        }), { label: "Ajustes visuales" });
      }
      else if (a === "fit") await fit();
      else if (a === "flip-x") await flip("x");
      else if (a === "flip-y") await flip("y");
      else if (a === "humanize") await humanize(0.1);
      else if (a === "scenic") await scenicMode();
      else if (a === "focus") focusSelected();
      else if (a === "spotlight") focusSelected({ spotlight: true });
      else if (a === "clear-focus") clearFocus();
      else if (a === "preset") await applyPreset(btn.dataset.preset);
      else if (a === "save-preset") await savePreset(val("presetName"));
      else if (a === "copy") await copyAppearance();
      else if (a === "paste") await pasteAppearance();
      else if (a === "equalize") await equalize("scale");
      else if (a === "undo") await undo();
      else if (a === "restore") await restoreOriginal();
      if (!["focus","spotlight","clear-focus","copy"].includes(a)) rerender();
    });
    const range = root.querySelector('[name="scaleRange"]');
    range?.addEventListener("change", async e => { await scale(e.target.value); this.render(false); });
  }

  setPosition(options = {}) {
    const pos = super.setPosition(options);
    try {
      const state = { top: pos.top, left: pos.left, width: pos.width, height: pos.height };
      clearTimeout(this._mrtsSavePos);
      this._mrtsSavePos = setTimeout(() => game.settings.set(MODULE_ID, "panelState", state), 150);
    } catch (_) {}
    return pos;
  }
}

function openPanel() {
  if (!game.user.isGM && !game.settings.get(MODULE_ID, "allowPlayers")) return ui.notifications.warn("MR Token Stage: uso restringido por el GM.");
  runtime.app ??= new MRTokenStageApp();
  runtime.app.render(true);
}

function registerControls() {
  Hooks.on("getSceneControlButtons", controls => {
    const visible = game.user.isGM || game.settings.get(MODULE_ID, "allowPlayers");

    // Foundry v13/v14 use a Record<string, SceneControl>. Add MR Token Stage
    // as its own top-level control group so it always has a dedicated icon
    // in the left Scene Controls bar.
    if (!Array.isArray(controls)) {
      const existingOrders = Object.values(controls).map(c => Number(c?.order ?? 0));
      const order = (existingOrders.length ? Math.max(...existingOrders) : 0) + 10;

      controls["mr-token-stage"] = {
        name: "mr-token-stage",
        title: "MR Token Stage",
        icon: "fa-solid fa-masks-theater",
        order,
        visible,
        activeTool: "open-panel",
        tools: {
          "open-panel": {
            name: "open-panel",
            title: "Abrir panel MR Token Stage",
            icon: "fa-solid fa-sliders",
            order: 0,
            button: true,
            visible,
            onChange: (_event, active) => { if (active !== false) openPanel(); }
          },
          "scale-up": {
            name: "scale-up",
            title: "Aumentar escala visual 10%",
            icon: "fa-solid fa-magnifying-glass-plus",
            order: 10,
            button: true,
            visible,
            onChange: (_event, active) => { if (active !== false) scale(1.1, { relative: true }); }
          },
          "scale-down": {
            name: "scale-down",
            title: "Reducir escala visual 10%",
            icon: "fa-solid fa-magnifying-glass-minus",
            order: 20,
            button: true,
            visible,
            onChange: (_event, active) => { if (active !== false) scale(0.9, { relative: true }); }
          },
          humanize: {
            name: "humanize",
            title: "Humanizar grupo",
            icon: "fa-solid fa-people-group",
            order: 30,
            button: true,
            visible,
            onChange: (_event, active) => { if (active !== false) humanize(0.1); }
          },
          focus: {
            name: "focus",
            title: "Focus",
            icon: "fa-solid fa-eye",
            order: 40,
            button: true,
            visible,
            onChange: (_event, active) => { if (active !== false) focusSelected(); }
          },
          spotlight: {
            name: "spotlight",
            title: "Spotlight",
            icon: "fa-solid fa-sun",
            order: 50,
            button: true,
            visible,
            onChange: (_event, active) => { if (active !== false) focusSelected({ spotlight: true }); }
          },
          "clear-focus": {
            name: "clear-focus",
            title: "Limpiar Focus / Spotlight",
            icon: "fa-solid fa-eye-slash",
            order: 60,
            button: true,
            visible,
            onChange: (_event, active) => { if (active !== false) clearFocus(); }
          },
          scenic: {
            name: "scenic",
            title: "Token escénico",
            icon: "fa-solid fa-masks-theater",
            order: 70,
            button: true,
            visible,
            onChange: (_event, active) => { if (active !== false) scenicMode(); }
          },
          undo: {
            name: "undo",
            title: "Deshacer último cambio de MR Token Stage",
            icon: "fa-solid fa-rotate-left",
            order: 80,
            button: true,
            visible,
            onChange: (_event, active) => { if (active !== false) undo(); }
          },
          restore: {
            name: "restore",
            title: "Restaurar aspecto original",
            icon: "fa-solid fa-clock-rotate-left",
            order: 90,
            button: true,
            visible,
            onChange: (_event, active) => { if (active !== false) restoreOriginal(); }
          }
        }
      };
      return;
    }

    // Fallback for older/legacy control structures.
    controls.push({
      name: "mr-token-stage",
      title: "MR Token Stage",
      icon: "fa-solid fa-masks-theater",
      layer: "tokens",
      visible,
      activeTool: "open-panel",
      tools: [{
        name: "open-panel",
        title: "Abrir panel MR Token Stage",
        icon: "fa-solid fa-sliders",
        button: true,
        visible,
        onClick: openPanel
      }]
    });
  });
}

function registerHooks() {
  Hooks.on("controlToken", () => runtime.app?.render(false));
  Hooks.on("canvasTearDown", clearFocus);
  Hooks.on("deleteToken", (_, __, ___) => clearFocus());
}

function exposeAPI() {
  const api = {
    version: VERSION,
    open: openPanel,
    scale,
    offset,
    rotateTexture,
    opacity,
    flip,
    fit,
    copyAppearance,
    pasteAppearance,
    equalize,
    humanize,
    focus: () => focusSelected(),
    spotlight: () => focusSelected({ spotlight: true }),
    clearFocus,
    undo,
    scenicMode,
    restoreOriginal,
    applyPreset,
    savePreset,
    presets: getPresets
  };
  game.modules.get(MODULE_ID).api = api;
  game.mrTokenStage = api;
}

Hooks.once("init", () => {
  registerSettings();
  installMovementFacingProtection();
  registerControls();
  registerHooks();
});

Hooks.once("setup", () => installRulerSuppression());
Hooks.once("ready", () => {
  exposeAPI();
  console.log(`${MODULE_ID} | Ready v${VERSION}`);
});
