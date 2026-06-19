import {
  AmbientLight,
  BackSide,
  Color,
  DirectionalLight,
  DoubleSide,
  FrontSide,
  GridHelper,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  RepeatWrapping,
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
  FORGE_MATERIAL_SIDES,
  FORGE_MATERIAL_TYPES,
  normalizeForgeMaterialDef,
  type ForgeMaterialAlphaMode,
  type ForgeMaterialDef,
  type ForgeMaterialSide,
  type ForgeMaterialType,
} from "@engine/assets/material";
import { projectFileUrl } from "@/project/ProjectSystem";
import { loadMaterialAsset, saveMaterialAsset } from "@/editor/materialStore";
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
        <label class="me-row"><span>Mask Texture</span><select data-me-field="maskTexture">${this.textureOptions("maskTexture")}</select></label>
      </div>
      <div class="me-section">
        <div class="me-section-title">Surface</div>
        ${this.numberRow("Roughness", "roughness", this.def.roughness, 0, 1, 0.01)}
        ${this.numberRow("Metalness", "metalness", this.def.metalness, 0, 1, 0.01)}
        ${this.numberRow("Opacity", "opacity", this.def.opacity, 0, 1, 0.01)}
        <label class="me-row"><span>Alpha Mode</span><select data-me-field="alphaMode">${this.enumOptions(FORGE_MATERIAL_ALPHA_MODES, this.def.alphaMode)}</select></label>
        ${this.numberRow("Alpha Test", "alphaTest", this.def.alphaTest, 0, 1, 0.01)}
        <label class="me-row"><span>Side</span><select data-me-field="side">${this.enumOptions(FORGE_MATERIAL_SIDES, this.def.side)}</select></label>
      </div>
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
      "roughness" | "metalness" | "opacity" | "alphaTest" | "emissiveIntensity"
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

  private textureOptions(field: "baseColorTexture" | "normalTexture" | "maskTexture"): string {
    const current = this.def[field];
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

  private async applyField(input: HTMLInputElement | HTMLSelectElement): Promise<void> {
    const field = input.dataset.meField;
    if (!field) return;
    const next = { ...this.def };
    if (field === "name") next.name = input.value.trim() || this.options.label;
    else if (field === "materialType") next.materialType = input.value as ForgeMaterialType;
    else if (field === "baseColor") next.baseColor = input.value;
    else if (field === "baseColorTexture") next.baseColorTexture = input.value || null;
    else if (field === "normalTexture") next.normalTexture = input.value || null;
    else if (field === "maskTexture") next.maskTexture = input.value || null;
    else if (field === "roughness") next.roughness = numberInput(input.value, 0, 1);
    else if (field === "metalness") next.metalness = numberInput(input.value, 0, 1);
    else if (field === "opacity") next.opacity = numberInput(input.value, 0, 1);
    else if (field === "alphaMode") next.alphaMode = input.value as ForgeMaterialAlphaMode;
    else if (field === "alphaTest") next.alphaTest = numberInput(input.value, 0, 1);
    else if (field === "side") next.side = input.value as ForgeMaterialSide;
    else if (field === "emissive") next.emissive = input.value;
    else if (field === "emissiveIntensity") next.emissiveIntensity = numberInput(input.value, 0, 20);
    this.def = normalizeForgeMaterialDef(next, this.options.label);
    this.dirty = true;
    this.titleEl.textContent = this.def.name;
    this.syncFieldControls(field, input.value);
    this.markDirty();
    await this.updatePreviewMaterial();
    this.warnIfTransparentMaterial(field);
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

  private async updatePreviewMaterial(): Promise<void> {
    this.disposePreviewMaterial();
    const shared = {
      color: new Color(this.def.baseColor),
      transparent: this.def.alphaMode === "blend" || this.def.opacity < 1,
      opacity: this.def.opacity,
      alphaTest: this.def.alphaMode === "mask" ? this.def.alphaTest : 0,
      side: materialSide(this.def.side),
    };
    const material =
      this.def.materialType === "basic"
        ? new MeshBasicMaterial(shared)
        : new MeshStandardMaterial({
            ...shared,
            roughness: this.def.roughness,
            metalness: this.def.metalness,
            emissive: new Color(this.def.emissive),
            emissiveIntensity: this.def.emissiveIntensity,
          });
    const baseMap = await this.loadTexture(this.def.baseColorTexture);
    if (baseMap) {
      baseMap.colorSpace = SRGBColorSpace;
      material.map = baseMap;
    }
    if (material instanceof MeshStandardMaterial) {
      const normalMap = await this.loadTexture(this.def.normalTexture);
      if (normalMap) material.normalMap = normalMap;
    }
    material.needsUpdate = true;
    this.previewMaterial = material;
    this.sphere.material = material;
    this.renderPreview();
  }

  private async loadTexture(assetId: string | null): Promise<Texture | null> {
    if (!assetId) return null;
    const asset = this.options.assets?.find((entry) => entry.id === assetId && entry.assetType === "texture");
    if (!asset) return null;
    const texture = await this.textureLoader.loadAsync(projectFileUrl(asset.path));
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
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

function materialSide(side: ForgeMaterialSide): typeof FrontSide | typeof BackSide | typeof DoubleSide {
  if (side === "back") return BackSide;
  if (side === "double") return DoubleSide;
  return FrontSide;
}
