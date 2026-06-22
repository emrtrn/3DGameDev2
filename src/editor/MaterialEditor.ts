import {
  AmbientLight,
  Color,
  DirectionalLight,
  GridHelper,
  Mesh,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  WebGLRenderer,
  type Material,
} from "three";

import {
  FORGE_MATERIAL_ALPHA_MODES,
  FORGE_MATERIAL_LAYER_BLEND_DRIVERS,
  FORGE_MATERIAL_SIDES,
  FORGE_MATERIAL_TYPES,
  normalizeForgeMaterialDef,
  type ForgeMaterialAlphaMode,
  type ForgeMaterialDef,
  type ForgeMaterialLayerBlend,
  type ForgeMaterialLayerBlendDriver,
  type ForgeMaterialSide,
  type ForgeMaterialType,
} from "@engine/assets/material";
import { projectFileUrl } from "@/project/ProjectSystem";
import { loadMaterialAsset, saveMaterialAsset } from "@/editor/materialStore";
import { createThreeMaterialFromForgeDef } from "@engine/render-three/materials";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type StatusTone = "info" | "success" | "warning" | "error";

export interface MaterialEditorAssetOption {
  id: string;
  name: string;
  assetType: string;
  path: string;
}

export interface MaterialEditorOptions {
  path: string;
  label: string;
  materialId?: string;
  assets?: readonly MaterialEditorAssetOption[];
  onStatus?: (message: string, tone?: StatusTone) => void;
  onSaved?: () => void;
  onApplyToSelected?: (materialId: string) => void;
  onBrowse?: () => void;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class MaterialEditor {
  private static activeInstance: MaterialEditor | null = null;

  static async open(options: MaterialEditorOptions): Promise<MaterialEditor> {
    MaterialEditor.activeInstance?.close();
    const editor = new MaterialEditor(options);
    MaterialEditor.activeInstance = editor;
    await editor.load();
    return editor;
  }

  private readonly overlay: HTMLDivElement;
  private readonly titleEl: HTMLElement;
  private readonly previewHost: HTMLElement;
  private readonly detailsHost: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(32, 1, 0.01, 100);
  private readonly sphere = new Mesh(new SphereGeometry(0.9, 64, 40));
  private readonly textureLoader = new TextureLoader();
  private readonly loadedTextures: Texture[] = [];
  private readonly controls: OrbitControls;
  private readonly resizeObserver: ResizeObserver;

  private def: ForgeMaterialDef;
  private previewMaterial: Material | null = null;
  private dirty = false;
  private disposed = false;

  private constructor(private readonly options: MaterialEditorOptions) {
    this.def = normalizeForgeMaterialDef({ name: options.label }, options.label);
    this.overlay = document.createElement("div");
    this.overlay.className = "me-editor-overlay";
    this.overlay.innerHTML = `
      <div class="me-editor-window">
        <header class="me-editor-header">
          <span class="me-editor-tab">
            <span class="me-editor-tab-icon">M</span>
            <strong data-me-title></strong>
            <span class="me-editor-badge">Material</span>
          </span>
          <div class="me-editor-header-actions">
            <button type="button" class="me-editor-save" data-me-save title="Save (Ctrl+S)">Save</button>
            <button type="button" class="me-editor-close" data-me-close title="Close (Esc)">x</button>
          </div>
        </header>
        <div class="me-editor-toolbar">
          <button type="button" data-me-tb-save title="Save (Ctrl+S)">Save</button>
          <button type="button" data-me-apply title="Assign this material to the selected static mesh" ${options.materialId ? "" : "disabled"}>Apply to Selected</button>
          <button type="button" data-me-browse title="Reveal in Content Browser">Browse</button>
          <span class="me-editor-toolbar-spacer"></span>
          <span>MeshStandardMaterial first pass</span>
        </div>
        <div class="me-editor-body">
          <main class="me-editor-preview" data-me-preview></main>
          <aside class="me-editor-details" data-me-details></aside>
        </div>
        <footer class="me-editor-status" data-me-status>Loading...</footer>
      </div>
    `;
    document.body.append(this.overlay);

    this.titleEl = this.requireEl("[data-me-title]");
    this.previewHost = this.requireEl("[data-me-preview]");
    this.detailsHost = this.requireEl("[data-me-details]");
    this.statusEl = this.requireEl("[data-me-status]");

    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.previewHost.append(this.renderer.domElement);
    this.setupPreviewScene();
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.controls.addEventListener("change", () => this.renderPreview());
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.previewHost);

    this.requireEl<HTMLButtonElement>("[data-me-close]").addEventListener("click", () =>
      this.close(),
    );
    this.requireEl<HTMLButtonElement>("[data-me-save]").addEventListener("click", () =>
      void this.save(),
    );
    this.requireEl<HTMLButtonElement>("[data-me-tb-save]").addEventListener("click", () =>
      void this.save(),
    );
    this.requireEl<HTMLButtonElement>("[data-me-browse]").addEventListener("click", () =>
      this.options.onBrowse?.(),
    );
    this.requireEl<HTMLButtonElement>("[data-me-apply]").addEventListener("click", () => {
      if (!this.options.materialId) return;
      this.options.onApplyToSelected?.(this.options.materialId);
    });
    this.overlay.tabIndex = -1;
    this.overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.close();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void this.save();
      }
    });
    window.addEventListener("resize", this.resize);
    requestAnimationFrame(() => this.resize());
    this.overlay.focus();
  }

  private requireEl<T extends HTMLElement = HTMLElement>(selector: string): T {
    const el = this.overlay.querySelector<T>(selector);
    if (!el) throw new Error(`MaterialEditor: missing element ${selector}`);
    return el;
  }

  private setupPreviewScene(): void {
    this.scene.background = new Color(0x191b1f);
    this.scene.add(new AmbientLight(0xffffff, 1.1));
    const key = new DirectionalLight(0xffffff, 3);
    key.position.set(3, 4, 3);
    this.scene.add(key);
    const rim = new DirectionalLight(0x9fc7ff, 1.2);
    rim.position.set(-3, 2, -2);
    this.scene.add(rim);
    const grid = new GridHelper(4, 16, 0x464a51, 0x292c31);
    grid.position.y = -0.95;
    this.scene.add(grid);
    this.scene.add(this.sphere);
    this.camera.position.set(0, 0.15, 4.2);
    this.camera.lookAt(0, 0, 0);
  }

  private async load(): Promise<void> {
    try {
      this.def = await loadMaterialAsset(this.options.path, this.options.label);
      this.dirty = false;
      this.render();
      await this.updatePreviewMaterial();
      this.setStatus("Ready.");
    } catch (error) {
      this.render();
      this.setStatus(`Failed to load: ${describeError(error)}`, "error");
    }
  }

  private render(): void {
    if (this.disposed) return;
    this.titleEl.textContent = this.def.name;
    this.renderDetails();
    this.resize();
  }

  private renderDetails(): void {
    this.detailsHost.innerHTML = `
      <div class="me-details-heading">Details</div>
      <div class="me-section">
        <div class="me-section-title">Material</div>
        <label class="me-row"><span>Name</span><input data-me-field="name" type="text" value="${escapeHtml(this.def.name)}" /></label>
        <label class="me-row"><span>Type</span><select data-me-field="materialType">${this.enumOptions(FORGE_MATERIAL_TYPES, this.def.materialType)}</select></label>
        <label class="me-row"><span>Base Color</span><input data-me-field="baseColor" type="color" value="${escapeHtml(this.def.baseColor)}" /></label>
        <label class="me-row"><span>Base Texture</span><select data-me-field="baseColorTexture">${this.textureOptions("baseColorTexture")}</select></label>
        <label class="me-row"><span>Normal Texture</span><select data-me-field="normalTexture">${this.textureOptions("normalTexture")}</select></label>
        ${this.uvTilingRow()}
      </div>
      <div class="me-section">
        <div class="me-section-title">Surface</div>
        ${this.numberRow("Roughness", "roughness", this.def.roughness, 0, 1, 0.01)}
        ${this.numberRow("Metalness", "metalness", this.def.metalness, 0, 1, 0.01)}
        ${this.surfaceTextureRows()}
        ${this.numberRow("Opacity", "opacity", this.def.opacity, 0, 1, 0.01)}
        <label class="me-row"><span>Alpha Mode</span><select data-me-field="alphaMode">${this.enumOptions(FORGE_MATERIAL_ALPHA_MODES, this.def.alphaMode)}</select></label>
        ${this.numberRow("Alpha Test", "alphaTest", this.def.alphaTest, 0, 1, 0.01)}
        <label class="me-row"><span>Side</span><select data-me-field="side">${this.enumOptions(FORGE_MATERIAL_SIDES, this.def.side)}</select></label>
      </div>
      ${this.layerBlendSection()}
      <div class="me-section">
        <div class="me-section-title">Emissive</div>
        <label class="me-row"><span>Color</span><input data-me-field="emissive" type="color" value="${escapeHtml(this.def.emissive)}" /></label>
        ${this.numberRow("Intensity", "emissiveIntensity", this.def.emissiveIntensity, 0, 20, 0.1)}
      </div>
    `;
    this.detailsHost.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-me-field]")
      .forEach((input) => {
        input.addEventListener("input", () => void this.applyField(input));
        input.addEventListener("change", () => void this.applyField(input));
      });
  }

  private enumOptions<T extends string>(values: readonly T[], current: T): string {
    return values
      .map((value) => `<option value="${value}" ${value === current ? "selected" : ""}>${value}</option>`)
      .join("");
  }

  private numberRow(
    label: string,
    field: keyof Pick<
      ForgeMaterialDef,
      "roughness" | "metalness" | "aoIntensity" | "opacity" | "alphaTest" | "emissiveIntensity"
    >,
    value: number,
    min: number,
    max: number,
    step: number,
  ): string {
    return `
      <label class="me-row">
        <span>${label}</span>
        <span class="me-number-pair">
          <input data-me-field="${field}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
          <input data-me-field="${field}" type="number" min="${min}" max="${max}" step="${step}" value="${value}" />
        </span>
      </label>
    `;
  }

  private uvTilingRow(): string {
    return `
      <label class="me-row">
        <span>UV Tiling</span>
        <span class="me-number-pair">
          <input data-me-field="uvTilingX" type="number" min="0.001" max="100" step="0.1" value="${this.def.uvTiling.x}" title="Texture repeat on U/X" />
          <input data-me-field="uvTilingY" type="number" min="0.001" max="100" step="0.1" value="${this.def.uvTiling.y}" title="Texture repeat on V/Y" />
        </span>
      </label>
    `;
  }

  private surfaceTextureRows(): string {
    const mode = this.textureMapMode();
    return `
      <label class="me-row"><span>Map Mode</span><select data-me-field="textureMapMode">${this.enumOptions(["separate", "orm"] as const, mode)}</select></label>
      ${
        mode === "orm"
          ? `
            <label class="me-row"><span>ORM Texture</span><select data-me-field="ormTexture">${this.textureOptions("ormTexture")}</select></label>
            ${this.numberRow("AO Intensity", "aoIntensity", this.def.aoIntensity, 0, 1, 0.01)}
          `
          : `
            <label class="me-row"><span>Roughness Map</span><select data-me-field="roughnessTexture">${this.textureOptions("roughnessTexture")}</select></label>
            <label class="me-row"><span>Metalness Map</span><select data-me-field="metalnessTexture">${this.textureOptions("metalnessTexture")}</select></label>
            <label class="me-row"><span>AO Map</span><select data-me-field="aoTexture">${this.textureOptions("aoTexture")}</select></label>
            ${this.numberRow("AO Intensity", "aoIntensity", this.def.aoIntensity, 0, 1, 0.01)}
          `
      }
    `;
  }

  private layerBlendSection(): string {
    const blend = this.def.layerBlend;
    return `
      <div class="me-section">
        <div class="me-section-title">Layer Blend</div>
        <label class="me-row"><span>Enabled</span><input data-me-field="layerBlendEnabled" type="checkbox" ${blend ? "checked" : ""} /></label>
        ${
          blend
            ? `
              <label class="me-row"><span>Layer 1 Color</span><input data-me-field="layer1BaseColor" type="color" value="${escapeHtml(blend.layer1.baseColor)}" /></label>
              <label class="me-row"><span>BC₂ Texture</span><select data-me-field="layer1BaseColorTexture">${this.textureOptions("layer1BaseColorTexture")}</select></label>
              <label class="me-row"><span>N₂ Texture</span><select data-me-field="layer1NormalTexture">${this.textureOptions("layer1NormalTexture")}</select></label>
              <label class="me-row"><span>R₂ Texture</span><select data-me-field="layer1RoughnessTexture">${this.textureOptions("layer1RoughnessTexture")}</select></label>
              <label class="me-row"><span>M₂ Texture</span><select data-me-field="layer1MetalnessTexture">${this.textureOptions("layer1MetalnessTexture")}</select></label>
              ${this.layerNumberRow("Layer 1 Roughness", "layer1Roughness", blend.layer1.roughness, 0, 1, 0.01)}
              ${this.layerNumberRow("Layer 1 Metalness", "layer1Metalness", blend.layer1.metalness, 0, 1, 0.01)}
              <label class="me-row">
                <span>Layer 1 UV</span>
                <span class="me-number-pair">
                  <input data-me-field="layer1UvTilingX" type="number" min="0.001" max="100" step="0.1" value="${blend.layer1.uvTiling.x}" title="Layer 1 texture repeat on U/X" />
                  <input data-me-field="layer1UvTilingY" type="number" min="0.001" max="100" step="0.1" value="${blend.layer1.uvTiling.y}" title="Layer 1 texture repeat on V/Y" />
                </span>
              </label>
              <label class="me-row"><span>Driver</span><select data-me-field="layerBlendDriver">${this.enumOptions(FORGE_MATERIAL_LAYER_BLEND_DRIVERS, blend.driver)}</select></label>
              ${this.layerNumberRow("Blend Amount", "layerBlendAmount", blend.amount, 0, 1, 0.01)}
              ${this.layerNumberRow("Blend Min", "layerBlendMin", blend.min, -100000, 100000, 0.1)}
              ${this.layerNumberRow("Blend Max", "layerBlendMax", blend.max, -100000, 100000, 0.1)}
              ${this.layerNumberRow("Blend Contrast", "layerBlendContrast", blend.contrast, 0.01, 8, 0.01)}
            `
            : ""
        }
      </div>
    `;
  }

  private layerNumberRow(
    label: string,
    field: string,
    value: number,
    min: number,
    max: number,
    step: number,
  ): string {
    return `
      <label class="me-row">
        <span>${label}</span>
        <input data-me-field="${field}" type="number" min="${min}" max="${max}" step="${step}" value="${value}" />
      </label>
    `;
  }

  private textureMapMode(): "separate" | "orm" {
    return this.def.ormTexture || this.def.maskTexture ? "orm" : "separate";
  }

  private textureOptions(
    field:
      | "baseColorTexture"
      | "normalTexture"
      | "roughnessTexture"
      | "metalnessTexture"
      | "aoTexture"
      | "ormTexture"
      | "layer1BaseColorTexture"
      | "layer1NormalTexture"
      | "layer1RoughnessTexture"
      | "layer1MetalnessTexture",
  ): string {
    const current = isLayerTextureField(field)
      ? this.layerTextureValue(field)
      : this.def[field];
    const textures = this.options.assets?.filter((asset) => asset.assetType === "texture") ?? [];
    return [`<option value="" ${current ? "" : "selected"}>None</option>`]
      .concat(
        textures.map(
          (asset) =>
            `<option value="${escapeHtml(asset.id)}" ${
              current === asset.id ? "selected" : ""
            }>${escapeHtml(asset.name)}</option>`,
        ),
      )
      .join("");
  }

  private layerTextureValue(field: string): string | null {
    const layer1 = this.def.layerBlend?.layer1;
    if (!layer1) return null;
    if (field === "layer1BaseColorTexture") return layer1.baseColorTexture;
    if (field === "layer1NormalTexture") return layer1.normalTexture;
    if (field === "layer1RoughnessTexture") return layer1.roughnessTexture;
    if (field === "layer1MetalnessTexture") return layer1.metalnessTexture;
    return null;
  }

  private async applyField(input: HTMLInputElement | HTMLSelectElement): Promise<void> {
    const field = input.dataset.meField;
    if (!field) return;
    const next = { ...this.def };
    if (field === "name") next.name = input.value.trim() || this.options.label;
    else if (field === "materialType") next.materialType = input.value as ForgeMaterialType;
    else if (field === "baseColor") next.baseColor = input.value;
    else if (field === "baseColorTexture") next.baseColorTexture = input.value || null;
    else if (field === "normalTexture") next.normalTexture = input.value || null;
    else if (field === "roughnessTexture") next.roughnessTexture = input.value || null;
    else if (field === "metalnessTexture") next.metalnessTexture = input.value || null;
    else if (field === "aoTexture") next.aoTexture = input.value || null;
    else if (field === "ormTexture") {
      next.ormTexture = input.value || null;
      next.maskTexture = null;
    }
    else if (field === "textureMapMode") {
      if (input.value === "orm") {
        next.ormTexture = next.ormTexture ?? next.maskTexture;
        next.maskTexture = null;
      } else {
        next.ormTexture = null;
        next.maskTexture = null;
      }
    }
    else if (field === "uvTilingX") next.uvTiling = { ...next.uvTiling, x: numberInput(input.value, 0.001, 100) };
    else if (field === "uvTilingY") next.uvTiling = { ...next.uvTiling, y: numberInput(input.value, 0.001, 100) };
    else if (field === "roughness") next.roughness = numberInput(input.value, 0, 1);
    else if (field === "metalness") next.metalness = numberInput(input.value, 0, 1);
    else if (field === "aoIntensity") next.aoIntensity = numberInput(input.value, 0, 1);
    else if (field === "opacity") next.opacity = numberInput(input.value, 0, 1);
    else if (field === "alphaMode") next.alphaMode = input.value as ForgeMaterialAlphaMode;
    else if (field === "alphaTest") next.alphaTest = numberInput(input.value, 0, 1);
    else if (field === "side") next.side = input.value as ForgeMaterialSide;
    else if (field === "emissive") next.emissive = input.value;
    else if (field === "emissiveIntensity") next.emissiveIntensity = numberInput(input.value, 0, 20);
    else if (field === "layerBlendEnabled") {
      const checked = input instanceof HTMLInputElement && input.checked;
      next.layerBlend = checked ? defaultLayerBlend(next.layerBlend) : null;
    }
    else if (field.startsWith("layer1") || field.startsWith("layerBlend")) {
      next.layerBlend = this.applyLayerBlendField(next.layerBlend, field, input);
    }
    this.def = normalizeForgeMaterialDef(next, this.options.label);
    this.dirty = true;
    this.titleEl.textContent = this.def.name;
    this.syncFieldControls(field, input.value);
    this.markDirty();
    if (field === "textureMapMode" || field === "layerBlendEnabled") this.renderDetails();
    await this.updatePreviewMaterial();
    this.warnIfTransparentMaterial(field);
    this.warnIfSurfaceMapUsesScalar(field);
  }

  private applyLayerBlendField(
    blend: ForgeMaterialLayerBlend | null,
    field: string,
    input: HTMLInputElement | HTMLSelectElement,
  ): ForgeMaterialLayerBlend {
    const next = defaultLayerBlend(blend);
    if (field === "layer1BaseColor") next.layer1.baseColor = input.value;
    else if (field === "layer1BaseColorTexture") next.layer1.baseColorTexture = input.value || null;
    else if (field === "layer1NormalTexture") next.layer1.normalTexture = input.value || null;
    else if (field === "layer1RoughnessTexture") next.layer1.roughnessTexture = input.value || null;
    else if (field === "layer1MetalnessTexture") next.layer1.metalnessTexture = input.value || null;
    else if (field === "layer1Roughness") next.layer1.roughness = numberInput(input.value, 0, 1);
    else if (field === "layer1Metalness") next.layer1.metalness = numberInput(input.value, 0, 1);
    else if (field === "layer1UvTilingX") next.layer1.uvTiling = { ...next.layer1.uvTiling, x: numberInput(input.value, 0.001, 100) };
    else if (field === "layer1UvTilingY") next.layer1.uvTiling = { ...next.layer1.uvTiling, y: numberInput(input.value, 0.001, 100) };
    else if (field === "layerBlendDriver") next.driver = input.value as ForgeMaterialLayerBlendDriver;
    else if (field === "layerBlendAmount") next.amount = numberInput(input.value, 0, 1);
    else if (field === "layerBlendMin") next.min = numberInput(input.value, -100000, 100000);
    else if (field === "layerBlendMax") next.max = numberInput(input.value, -100000, 100000);
    else if (field === "layerBlendContrast") next.contrast = numberInput(input.value, 0.01, 8);
    return next;
  }

  private syncFieldControls(field: string, value: string): void {
    this.detailsHost
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-me-field="${field}"]`)
      .forEach((control) => {
        if (control.value !== value) control.value = value;
      });
  }

  private warnIfTransparentMaterial(field: string): void {
    if (field !== "opacity" && field !== "alphaMode") return;
    if (this.def.alphaMode === "blend" || this.def.opacity < 1) {
      this.setStatus("Transparent materials are supported, but render sorting can still depend on scene order.", "warning");
    }
  }

  private warnIfSurfaceMapUsesScalar(field: string): void {
    if (
      field !== "roughnessTexture" &&
      field !== "metalnessTexture" &&
      field !== "aoTexture" &&
      field !== "ormTexture"
    ) {
      return;
    }
    this.setStatus("Surface maps multiply the scalar sliders; set Roughness/Metalness near 1 for map-driven results.", "info");
  }

  private async updatePreviewMaterial(): Promise<void> {
    this.disposePreviewMaterial();
    const baseMap = await this.loadTexture(this.def.baseColorTexture);
    const normalMap = await this.loadTexture(this.def.normalTexture);
    const roughnessMap = await this.loadTexture(this.def.roughnessTexture);
    const metalnessMap = await this.loadTexture(this.def.metalnessTexture);
    const aoMap = await this.loadTexture(this.def.aoTexture);
    const ormMap = await this.loadTexture(this.def.ormTexture);
    const layer1BaseColorMap = await this.loadTexture(this.def.layerBlend?.layer1.baseColorTexture ?? null);
    const layer1NormalMap = await this.loadTexture(this.def.layerBlend?.layer1.normalTexture ?? null);
    const layer1RoughnessMap = await this.loadTexture(this.def.layerBlend?.layer1.roughnessTexture ?? null);
    const layer1MetalnessMap = await this.loadTexture(this.def.layerBlend?.layer1.metalnessTexture ?? null);
    const material = createThreeMaterialFromForgeDef(
      this.def,
      {
        baseColorTexture: baseMap,
        normalTexture: normalMap,
        roughnessTexture: roughnessMap,
        metalnessTexture: metalnessMap,
        aoTexture: aoMap,
        ormTexture: ormMap,
        layer1BaseColorTexture: layer1BaseColorMap,
        layer1NormalTexture: layer1NormalMap,
        layer1RoughnessTexture: layer1RoughnessMap,
        layer1MetalnessTexture: layer1MetalnessMap,
      },
      { maxAnisotropy: this.renderer.capabilities.getMaxAnisotropy() },
    );
    this.previewMaterial = material;
    this.sphere.material = material;
    this.renderPreview();
  }

  private async loadTexture(assetId: string | null): Promise<Texture | null> {
    if (!assetId) return null;
    const asset = this.options.assets?.find((entry) => entry.id === assetId && entry.assetType === "texture");
    if (!asset) return null;
    const texture = await this.textureLoader.loadAsync(projectFileUrl(asset.path));
    this.loadedTextures.push(texture);
    return texture;
  }

  private resize = (): void => {
    if (this.disposed) return;
    const rect = this.previewHost.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderPreview();
  };

  private renderPreview(): void {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  private async save(): Promise<void> {
    try {
      const result = await saveMaterialAsset(this.options.path, this.def);
      this.dirty = false;
      this.overlay.querySelector<HTMLButtonElement>("[data-me-save]")?.classList.remove("is-dirty");
      this.setStatus(result.changed ? `Saved ${result.path}` : "No changes to save.", "success");
      this.options.onSaved?.();
    } catch (error) {
      this.setStatus(`Save failed: ${describeError(error)}`, "error");
    }
  }

  private markDirty(): void {
    this.overlay.querySelector<HTMLButtonElement>("[data-me-save]")?.classList.add("is-dirty");
  }

  private setStatus(message: string, tone: StatusTone = "info"): void {
    this.statusEl.textContent = message;
    this.statusEl.dataset.tone = tone;
    this.options.onStatus?.(message, tone);
  }

  close(): void {
    if (this.disposed) return;
    if (this.dirty && !window.confirm("Close Material Editor without saving?")) return;
    this.disposed = true;
    window.removeEventListener("resize", this.resize);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.disposePreviewMaterial();
    this.sphere.geometry.dispose();
    this.renderer.dispose();
    this.overlay.remove();
    if (MaterialEditor.activeInstance === this) MaterialEditor.activeInstance = null;
  }

  private disposePreviewMaterial(): void {
    for (const texture of this.loadedTextures.splice(0)) texture.dispose();
    this.previewMaterial?.dispose();
    this.previewMaterial = null;
  }
}

function numberInput(value: string, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(Math.max(number, min), max);
}

function defaultLayerBlend(current: ForgeMaterialLayerBlend | null): ForgeMaterialLayerBlend {
  return {
    layer1: {
      baseColor: current?.layer1.baseColor ?? "#ffffff",
      baseColorTexture: current?.layer1.baseColorTexture ?? null,
      normalTexture: current?.layer1.normalTexture ?? null,
      roughnessTexture: current?.layer1.roughnessTexture ?? null,
      metalnessTexture: current?.layer1.metalnessTexture ?? null,
      roughness: current?.layer1.roughness ?? 0.8,
      metalness: current?.layer1.metalness ?? 0,
      uvTiling: current?.layer1.uvTiling ?? { x: 1, y: 1 },
    },
    driver: current?.driver ?? "constant",
    amount: current?.amount ?? 0.5,
    min: current?.min ?? 0,
    max: current?.max ?? 1,
    contrast: current?.contrast ?? 1,
  };
}

function isLayerTextureField(field: string): field is
  | "layer1BaseColorTexture"
  | "layer1NormalTexture"
  | "layer1RoughnessTexture"
  | "layer1MetalnessTexture" {
  return field.startsWith("layer1");
}
