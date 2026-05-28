import {
  BatteryMedium,
  Box,
  CircleDot,
  Columns3,
  Download,
  Gamepad2,
  Grid3X3,
  Keyboard,
  Layers,
  ListChecks,
  Map,
  MessageSquare,
  MousePointer2,
  Moon,
  PanelTop,
  Plus,
  Rows3,
  Settings2,
  Shield,
  Square,
  SquareMousePointer,
  Sun,
  Target,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildDesignYaml, buildFlowsYaml, buildTokensYaml, downloadTextFile } from "./exporters";
import {
  createComponent,
  defaultFlowDocument,
  defaultTokens,
  sampleDesign,
} from "./sampleData";
import { ANCHORS, COMPONENT_TYPES, type ComponentType, type DesignDocument, type UIComponent } from "./types";

const componentIcons: Record<ComponentType, LucideIcon> = {
  Panel: PanelTop,
  Button: SquareMousePointer,
  IconButton: CircleDot,
  ProgressBar: BatteryMedium,
  ResourceCounter: Target,
  InventoryGrid: Grid3X3,
  SkillSlot: Zap,
  Tooltip: MessageSquare,
  Modal: Square,
  TabGroup: Columns3,
  DialogueBox: MessageSquare,
  QuestTracker: ListChecks,
  Minimap: Map,
  StatusEffectList: Rows3,
  EquipmentSlot: Shield,
};

interface DragState {
  id: string;
  offsetX: number;
  offsetY: number;
}

interface CanvasPoint {
  x: number;
  y: number;
}

type ThemeMode = "light" | "dark";

export default function App() {
  const [design, setDesign] = useState<DesignDocument>(() => structuredClone(sampleDesign));
  const [selectedId, setSelectedId] = useState<string | null>("player_hp");
  const [componentIndex, setComponentIndex] = useState(sampleDesign.components.length + 1);
  const [canvasViewport, setCanvasViewport] = useState({ width: 1, height: 1 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("light");

  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const selectedComponent = design.components.find((component) => component.id === selectedId) ?? null;
  const [baseWidth, baseHeight] = design.base_resolution;

  const scale = useMemo(() => {
    const horizontal = (canvasViewport.width - 32) / baseWidth;
    const vertical = (canvasViewport.height - 32) / baseHeight;
    return Math.max(0.12, Math.min(horizontal, vertical, 1.25));
  }, [baseHeight, baseWidth, canvasViewport.height, canvasViewport.width]);

  useEffect(() => {
    const node = canvasViewportRef.current;
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      setCanvasViewport({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!drag) return;

    const handlePointerMove = (event: PointerEvent) => {
      const point = getCanvasPoint(event);
      if (!point) return;

      setDesign((current) => ({
        ...current,
        components: current.components.map((component) => {
          if (component.id !== drag.id) return component;
          const nextX = clamp(Math.round(point.x - drag.offsetX), 0, current.base_resolution[0] - component.size[0]);
          const nextY = clamp(Math.round(point.y - drag.offsetY), 0, current.base_resolution[1] - component.size[1]);
          return { ...component, position: [nextX, nextY] };
        }),
      }));
    };

    const handlePointerUp = () => setDrag(null);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [drag, scale]);

  function getCanvasPoint(event: PointerEvent | React.PointerEvent): CanvasPoint | null {
    const node = canvasViewportRef.current;
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    const visibleWidth = baseWidth * scale;
    const visibleHeight = baseHeight * scale;
    const offsetLeft = (rect.width - visibleWidth) / 2;
    const offsetTop = (rect.height - visibleHeight) / 2;
    return {
      x: (event.clientX - rect.left - offsetLeft) / scale,
      y: (event.clientY - rect.top - offsetTop) / scale,
    };
  }

  function addComponent(type: ComponentType) {
    const component = createComponent(type, componentIndex);
    setDesign((current) => ({
      ...current,
      components: [...current.components, component],
    }));
    setSelectedId(component.id);
    setComponentIndex((value) => value + 1);
  }

  function updateSelected(updater: (component: UIComponent) => UIComponent) {
    if (!selectedComponent) return;
    setDesign((current) => ({
      ...current,
      components: current.components.map((component) =>
        component.id === selectedComponent.id ? updater(component) : component,
      ),
    }));
  }

  function updateSelectedId(nextId: string) {
    if (!selectedComponent) return;
    const previousId = selectedComponent.id;
    setDesign((current) => ({
      ...current,
      components: current.components.map((component) => {
        if (component.id !== previousId) return component;
        return {
          ...component,
          id: nextId,
          interactions: component.interactions.map((interaction) => ({
            ...interaction,
            trigger: interaction.trigger.replace(previousId, nextId),
          })),
        };
      }),
    }));
    setSelectedId(nextId);
  }

  function updatePosition(axis: 0 | 1, value: number) {
    updateSelected((component) => {
      const nextPosition: [number, number] = [...component.position];
      nextPosition[axis] = value;
      return { ...component, position: nextPosition };
    });
  }

  function updateSize(axis: 0 | 1, value: number) {
    updateSelected((component) => {
      const nextSize: [number, number] = [...component.size];
      nextSize[axis] = Math.max(8, value);
      return { ...component, size: nextSize };
    });
  }

  function updatePrimaryInteraction(field: "action" | "keyboard_input" | "gamepad_input", value: string) {
    updateSelected((component) => {
      const firstInteraction = component.interactions[0] ?? {
        trigger: `${component.id}.click`,
        action: "",
      };
      return {
        ...component,
        interactions: [{ ...firstInteraction, [field]: value }, ...component.interactions.slice(1)],
      };
    });
  }

  function updateResolution(axis: 0 | 1, value: number) {
    setDesign((current) => {
      const nextResolution: [number, number] = [...current.base_resolution];
      nextResolution[axis] = Math.max(320, value);
      return { ...current, base_resolution: nextResolution };
    });
  }

  function exportYamlFiles() {
    downloadTextFile("design.yaml", buildDesignYaml(design));
    downloadTextFile("tokens.yaml", buildTokensYaml(defaultTokens));
    downloadTextFile("flows.yaml", buildFlowsYaml(design, defaultFlowDocument));
  }

  function handleComponentPointerDown(event: React.PointerEvent, component: UIComponent) {
    event.stopPropagation();
    setSelectedId(component.id);
    const point = getCanvasPoint(event);
    if (!point) return;
    setDrag({
      id: component.id,
      offsetX: point.x - component.position[0],
      offsetY: point.y - component.position[1],
    });
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="topbar">
        <div className="topbar-group project-group">
          <Layers size={18} aria-hidden="true" />
          <input
            aria-label="File name"
            className="screen-input"
            value={design.screen}
            onChange={(event) => setDesign((current) => ({ ...current, screen: event.target.value }))}
          />
        </div>

        <div className="topbar-group resolution-group">
          <span className="resolution-label">Resolution</span>
          <TopbarNumberInput
            label="Base width"
            value={baseWidth}
            min={320}
            onChange={(value) => updateResolution(0, value)}
          />
          <span className="resolution-separator">x</span>
          <TopbarNumberInput
            label="Base height"
            value={baseHeight}
            min={320}
            onChange={(value) => updateResolution(1, value)}
          />
        </div>

        <button
          className="icon-button"
          type="button"
          onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
          title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        >
          {theme === "light" ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}
        </button>

        <button className="primary-button" type="button" onClick={exportYamlFiles} title="Export YAML files">
          <Download size={17} aria-hidden="true" />
          <span>Export</span>
        </button>
      </header>

      <main className="workspace">
        <aside className="left-panel">
          <div className="panel-header">
            <Box size={17} aria-hidden="true" />
            <span>Palette</span>
          </div>
          <div className="palette-list">
            {COMPONENT_TYPES.map((type) => {
              const Icon = componentIcons[type];
              return (
                <button
                  className="palette-item"
                  key={type}
                  type="button"
                  onClick={() => addComponent(type)}
                  title={`Add ${type}`}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{type}</span>
                  <Plus size={14} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </aside>

        <section className="canvas-panel" aria-label="Canvas editor">
          <div className="canvas-toolbar">
            <div className="canvas-meta">
              <MousePointer2 size={16} aria-hidden="true" />
              <span>{selectedComponent ? selectedComponent.id : "No selection"}</span>
            </div>
            <div className="canvas-scale">{Math.round(scale * 100)}%</div>
          </div>

          <div
            className="canvas-viewport"
            ref={canvasViewportRef}
            onPointerDown={() => {
              setSelectedId(null);
              setDrag(null);
            }}
          >
            <div
              className="canvas-frame"
              style={{
                width: baseWidth * scale,
                height: baseHeight * scale,
              }}
            >
              <div
                className="canvas-surface"
                style={{
                  width: baseWidth,
                  height: baseHeight,
                  transform: `scale(${scale})`,
                }}
              >
                <div
                  className="safe-area"
                  style={{
                    left: design.safe_area,
                    top: design.safe_area,
                    right: design.safe_area,
                    bottom: design.safe_area,
                  }}
                />
                {design.components
                  .slice()
                  .sort((a, b) => a.z_index - b.z_index)
                  .map((component) => (
                    <WireframeComponent
                      key={component.id}
                      component={component}
                      selected={component.id === selectedId}
                      onPointerDown={(event) => handleComponentPointerDown(event, component)}
                    />
                  ))}
              </div>
            </div>
          </div>
        </section>

        <aside className="right-panel">
          <div className="panel-header">
            <Settings2 size={17} aria-hidden="true" />
            <span>Properties</span>
          </div>

          {selectedComponent ? (
            <div className="property-list">
              <TextInput label="id" value={selectedComponent.id} onChange={updateSelectedId} />
              <ReadOnlyField label="type" value={selectedComponent.type} />
              <TextInput
                label="label"
                value={selectedComponent.label}
                onChange={(value) => updateSelected((component) => ({ ...component, label: value }))}
              />

              <div className="field-grid">
                <NumberInput label="x" value={selectedComponent.position[0]} onChange={(value) => updatePosition(0, value)} />
                <NumberInput label="y" value={selectedComponent.position[1]} onChange={(value) => updatePosition(1, value)} />
                <NumberInput label="width" value={selectedComponent.size[0]} min={8} onChange={(value) => updateSize(0, value)} />
                <NumberInput label="height" value={selectedComponent.size[1]} min={8} onChange={(value) => updateSize(1, value)} />
              </div>

              <label className="field">
                <span>anchor</span>
                <select
                  value={selectedComponent.anchor}
                  onChange={(event) =>
                    updateSelected((component) => ({ ...component, anchor: event.target.value as UIComponent["anchor"] }))
                  }
                >
                  {ANCHORS.map((anchor) => (
                    <option key={anchor} value={anchor}>
                      {anchor}
                    </option>
                  ))}
                </select>
              </label>

              <TextInput
                label="data_binding"
                value={selectedComponent.data_binding}
                onChange={(value) => updateSelected((component) => ({ ...component, data_binding: value }))}
              />
              <TextInput
                label="style_token"
                value={selectedComponent.style_token}
                onChange={(value) => updateSelected((component) => ({ ...component, style_token: value }))}
              />
              <NumberInput
                label="z_index"
                value={selectedComponent.z_index}
                onChange={(value) => updateSelected((component) => ({ ...component, z_index: value }))}
              />

              <div className="property-section">
                <div className="section-title">Interaction</div>
                <TextInput
                  label="action"
                  value={selectedComponent.interactions[0]?.action ?? ""}
                  onChange={(value) => updatePrimaryInteraction("action", value)}
                />
                <IconTextInput
                  icon={Keyboard}
                  label="keyboard input"
                  value={selectedComponent.interactions[0]?.keyboard_input ?? ""}
                  onChange={(value) => updatePrimaryInteraction("keyboard_input", value)}
                />
                <IconTextInput
                  icon={Gamepad2}
                  label="gamepad input"
                  value={selectedComponent.interactions[0]?.gamepad_input ?? ""}
                  onChange={(value) => updatePrimaryInteraction("gamepad_input", value)}
                />
              </div>
            </div>
          ) : (
            <div className="empty-properties">
              <MousePointer2 size={28} aria-hidden="true" />
              <span>No selection</span>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

function WireframeComponent({
  component,
  selected,
  onPointerDown,
}: {
  component: UIComponent;
  selected: boolean;
  onPointerDown: (event: React.PointerEvent) => void;
}) {
  const Icon = componentIcons[component.type];
  return (
    <div
      className={`wire-component wire-${component.type.toLowerCase()}${selected ? " is-selected" : ""}`}
      style={{
        left: component.position[0],
        top: component.position[1],
        width: component.size[0],
        height: component.size[1],
        zIndex: component.z_index,
      }}
      onPointerDown={onPointerDown}
      title={`${component.id} / ${component.type}`}
    >
      <div className="wire-header">
        <Icon size={18} aria-hidden="true" />
        <span>{component.label}</span>
      </div>
      {renderComponentBody(component)}
      <div className="wire-id">{component.id}</div>
    </div>
  );
}

function renderComponentBody(component: UIComponent) {
  if (component.type === "ProgressBar") {
    const fill = component.id.includes("enemy") ? "72%" : "64%";
    return (
      <div className="progress-track">
        <div className="progress-fill" style={{ width: fill }} />
      </div>
    );
  }

  if (component.id === "skill_bar") {
    return (
      <div className="skill-strip">
        {[1, 2, 3, 4, 5].map((key) => (
          <div className="skill-cell" key={key}>
            <Zap size={18} aria-hidden="true" />
            <span>{key}</span>
          </div>
        ))}
      </div>
    );
  }

  if (component.type === "ResourceCounter") {
    return (
      <div className="resource-row">
        <Target size={18} aria-hidden="true" />
        <span>{component.data_binding || "resource.value"}</span>
      </div>
    );
  }

  if (component.type === "StatusEffectList") {
    return (
      <div className="status-row">
        {[0, 1, 2, 3, 4].map((item) => (
          <span className="status-dot" key={item} />
        ))}
      </div>
    );
  }

  if (component.type === "Minimap") {
    return (
      <div className="minimap-grid">
        <span />
        <span />
      </div>
    );
  }

  if (component.type === "InventoryGrid") {
    return (
      <div className="inventory-grid">
        {Array.from({ length: 16 }).map((_, index) => (
          <span key={index} />
        ))}
      </div>
    );
  }

  if (component.type === "SkillSlot" || component.type === "EquipmentSlot" || component.type === "IconButton") {
    return (
      <div className="single-icon-body">
        {component.type === "EquipmentSlot" ? <Shield size={28} aria-hidden="true" /> : <Zap size={28} aria-hidden="true" />}
      </div>
    );
  }

  if (component.type === "TabGroup") {
    return (
      <div className="tab-row">
        <span className="active-tab">A</span>
        <span>B</span>
        <span>C</span>
      </div>
    );
  }

  if (component.type === "QuestTracker") {
    return (
      <div className="quest-lines">
        <span />
        <span />
        <span />
      </div>
    );
  }

  if (component.type === "DialogueBox") {
    return (
      <div className="dialogue-lines">
        <span />
        <span />
      </div>
    );
  }

  if (component.type === "Modal") {
    return (
      <div className="modal-wire-body">
        <button type="button" tabIndex={-1}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (component.type === "Button") {
    return <div className="button-body">{component.interactions[0]?.action || "action"}</div>;
  }

  if (component.type === "Tooltip") {
    return <div className="tooltip-line" />;
  }

  return <div className="panel-body-line" />;
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function IconTextInput({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field icon-field">
      <span>
        <Icon size={14} aria-hidden="true" />
        {label}
      </span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberInput({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field compact-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function TopbarNumberInput({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      className="resolution-input"
      aria-label={label}
      type="number"
      min={min}
      value={Number.isFinite(value) ? value : 0}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} readOnly disabled />
    </label>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
