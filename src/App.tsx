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
  Map as MapIcon,
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
  Trash2,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { buildDesignYaml, buildFlowsYaml, buildTokensYaml, downloadTextFile } from "./exporters";
import {
  createComponent,
  defaultFlowDocument,
  defaultTokens,
  sampleDesign,
} from "./sampleData";
import {
  ANCHORS,
  COMPONENT_TYPES,
  SNAP_MODES,
  type ComponentType,
  type DesignDocument,
  type SnapMode,
  type TokenDocument,
  type UIComponent,
} from "./types";

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
  Minimap: MapIcon,
  StatusEffectList: Rows3,
  EquipmentSlot: Shield,
};

interface DragState {
  mode: "move";
  id: string;
  offsetX: number;
  offsetY: number;
}

type ResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

interface ResizeState {
  mode: "resize";
  id: string;
  handle: ResizeHandle;
  startPoint: CanvasPoint;
  startPosition: [number, number];
  startSize: [number, number];
}

type CanvasEditState = DragState | ResizeState;
type ThemeMode = "light" | "dark";
type LeftPanelTab = "palette" | "components";
type RightPanelTab = "properties" | "tokens";
type SizeUnit = "px" | "percent";

interface CanvasPoint {
  x: number;
  y: number;
}

const RESIZE_HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export default function App() {
  const [design, setDesign] = useState<DesignDocument>(() => structuredClone(sampleDesign));
  const [tokens, setTokens] = useState(() => structuredClone(defaultTokens));
  const [selectedId, setSelectedId] = useState<string | null>("player_hp");
  const [componentIndex, setComponentIndex] = useState(sampleDesign.components.length + 1);
  const [canvasViewport, setCanvasViewport] = useState({ width: 1, height: 1 });
  const [canvasEdit, setCanvasEdit] = useState<CanvasEditState | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>("palette");
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>("properties");
  const [componentDragId, setComponentDragId] = useState<string | null>(null);

  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const selectedComponent = design.components.find((component) => component.id === selectedId) ?? null;
  const [baseWidth, baseHeight] = design.base_resolution;
  const tokenStyle = useMemo(() => buildTokenStyle(tokens), [tokens]);
  const sortedComponents = useMemo(() => sortComponentsForCanvas(design.components), [design.components]);
  const listComponents = useMemo(() => orderComponentsForList(design.components), [design.components]);

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
    if (!canvasEdit) return;

    const handlePointerMove = (event: PointerEvent) => {
      const point = getCanvasPoint(event);
      if (!point) return;

      setDesign((current) => ({
        ...current,
        components: current.components.map((component) => {
          if (component.id !== canvasEdit.id) return component;
          const snapMode = component.snap_mode ?? "canvas";

          if (canvasEdit.mode === "move") {
            const bounds = getMoveBounds(component.size, current.base_resolution, snapMode, current.safe_area);
            const nextX = clamp(Math.round(point.x - canvasEdit.offsetX), bounds.minX, bounds.maxX);
            const nextY = clamp(Math.round(point.y - canvasEdit.offsetY), bounds.minY, bounds.maxY);
            return { ...component, position: [nextX, nextY] };
          }

          const resized = getResizedFrame(canvasEdit, point, current.base_resolution, snapMode, current.safe_area);
          return {
            ...component,
            position: resized.position,
            size: resized.size,
            size_percent:
              component.size_unit === "percent"
                ? sizeToPercent(resized.size, current.base_resolution)
                : component.size_percent,
          };
        }),
      }));
    };

    const handlePointerUp = () => setCanvasEdit(null);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [canvasEdit, scale]);

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
        if (component.parent_id === previousId) {
          return { ...component, parent_id: nextId };
        }
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
      const nextValue =
        (component.size_unit ?? "px") === "percent"
          ? Math.round((Math.max(1, value) / 100) * design.base_resolution[axis])
          : value;
      nextSize[axis] = Math.max(8, nextValue);
      return {
        ...component,
        size: nextSize,
        size_percent: component.size_unit === "percent" ? sizeToPercent(nextSize, design.base_resolution) : component.size_percent,
      };
    });
  }

  function updateSizeUnit(unit: SizeUnit) {
    updateSelected((component) => ({
      ...component,
      size_unit: unit,
      size_percent: unit === "percent" ? sizeToPercent(component.size, design.base_resolution) : undefined,
    }));
  }

  function updateSnapMode(mode: SnapMode) {
    updateSelected((component) => ({
      ...component,
      snap_mode: mode,
    }));
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
      return {
        ...current,
        base_resolution: nextResolution,
        safe_area: clamp(current.safe_area, 0, getMaxSafeArea(nextResolution)),
      };
    });
  }

  function updateSafeArea(value: number) {
    setDesign((current) => ({
      ...current,
      safe_area: clamp(Math.round(Number.isFinite(value) ? value : 0), 0, getMaxSafeArea(current.base_resolution)),
    }));
  }

  function exportYamlFiles() {
    downloadTextFile("design.yaml", buildDesignYaml(design));
    downloadTextFile("tokens.yaml", buildTokensYaml(tokens));
    downloadTextFile("flows.yaml", buildFlowsYaml(design, defaultFlowDocument));
  }

  function handleComponentPointerDown(event: React.PointerEvent, component: UIComponent) {
    event.stopPropagation();
    setSelectedId(component.id);
    const point = getCanvasPoint(event);
    if (!point) return;
    setCanvasEdit({
      mode: "move",
      id: component.id,
      offsetX: point.x - component.position[0],
      offsetY: point.y - component.position[1],
    });
  }

  function handleResizePointerDown(event: React.PointerEvent, component: UIComponent, handle: ResizeHandle) {
    event.stopPropagation();
    setSelectedId(component.id);
    const point = getCanvasPoint(event);
    if (!point) return;
    setCanvasEdit({
      mode: "resize",
      id: component.id,
      handle,
      startPoint: point,
      startPosition: component.position,
      startSize: component.size,
    });
  }

  function deleteSelectedComponent() {
    if (!selectedComponent) return;
    const deletedId = selectedComponent.id;
    setDesign((current) => ({
      ...current,
      components: current.components
        .map((component) => (component.parent_id === deletedId ? { ...component, parent_id: undefined } : component))
        .filter((component) => component.id !== deletedId),
    }));
    setSelectedId(null);
  }

  function updateTokenValue(category: keyof typeof tokens, key: string, value: string) {
    setTokens((current) => {
      const section = current[category];
      const previousValue = section[key as keyof typeof section];
      const nextValue = typeof previousValue === "number" ? Number(value) : value;
      return {
        ...current,
        [category]: {
          ...section,
          [key]: Number.isNaN(nextValue) ? 0 : nextValue,
        },
      };
    });
  }

  function updateComponentParent(componentId: string, parentId: string) {
    setDesign((current) => {
      const component = current.components.find((item) => item.id === componentId);
      if (!component) return current;
      if (parentId && !canUseAsParent(componentId, parentId, current.components)) return current;
      const nextParentId = parentId || undefined;
      if (component.parent_id === nextParentId) return current;

      return {
        ...current,
        components: current.components.map((item) =>
          item.id === componentId ? { ...item, parent_id: nextParentId } : item,
        ),
      };
    });
  }

  function nestDraggedComponent(targetId: string) {
    if (!componentDragId || componentDragId === targetId) return;
    if (!canUseAsParent(componentDragId, targetId, design.components)) {
      setComponentDragId(null);
      return;
    }
    updateComponentParent(componentDragId, targetId);
    setComponentDragId(null);
  }

  return (
    <div className="app-shell" data-theme={theme} style={tokenStyle}>
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
          <span className="resolution-label">Padding</span>
          <TopbarNumberInput
            label="Canvas padding"
            value={design.safe_area}
            min={0}
            max={getMaxSafeArea(design.base_resolution)}
            onChange={updateSafeArea}
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
          <div className="panel-header tabbed-header">
            <div className="panel-title">
              {leftPanelTab === "palette" ? <Box size={17} aria-hidden="true" /> : <ListChecks size={17} aria-hidden="true" />}
              <span>{leftPanelTab === "palette" ? "Palette" : "Components"}</span>
            </div>
            <div className="panel-tabs" role="tablist" aria-label="Left panel">
              <button
                className={leftPanelTab === "palette" ? "is-active" : ""}
                type="button"
                role="tab"
                aria-selected={leftPanelTab === "palette"}
                onClick={() => setLeftPanelTab("palette")}
              >
                Palette
              </button>
              <button
                className={leftPanelTab === "components" ? "is-active" : ""}
                type="button"
                role="tab"
                aria-selected={leftPanelTab === "components"}
                onClick={() => setLeftPanelTab("components")}
              >
                List
              </button>
            </div>
          </div>

          {leftPanelTab === "palette" ? (
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
          ) : (
            <div className="component-list">
              {listComponents.map((component) => (
                <ComponentListItem
                  key={component.id}
                  component={component}
                  components={design.components}
                  depth={componentDepth(component, design.components)}
                  selected={component.id === selectedId}
                  dragging={component.id === componentDragId}
                  onDragStart={() => setComponentDragId(component.id)}
                  onDragEnd={() => setComponentDragId(null)}
                  onNestDrop={() => nestDraggedComponent(component.id)}
                  onSelect={() => {
                    setSelectedId(component.id);
                    setRightPanelTab("properties");
                  }}
                  onParentChange={(parentId) => updateComponentParent(component.id, parentId)}
                />
              ))}
            </div>
          )}
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
              setCanvasEdit(null);
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
                {sortedComponents.map((component) => (
                  <WireframeComponent
                    key={component.id}
                    component={component}
                    tokens={tokens}
                    selected={component.id === selectedId}
                    onPointerDown={(event) => handleComponentPointerDown(event, component)}
                    onResizePointerDown={(event, handle) => handleResizePointerDown(event, component, handle)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <aside className="right-panel">
          <div className="panel-header tabbed-header">
            <div className="panel-title">
              {rightPanelTab === "properties" ? <Settings2 size={17} aria-hidden="true" /> : <Wrench size={17} aria-hidden="true" />}
              <span>{rightPanelTab === "properties" ? "Properties" : "Tokens"}</span>
            </div>
            <div className="panel-tabs" role="tablist" aria-label="Inspector panels">
              <button
                className={rightPanelTab === "properties" ? "is-active" : ""}
                type="button"
                role="tab"
                aria-selected={rightPanelTab === "properties"}
                onClick={() => setRightPanelTab("properties")}
              >
                Props
              </button>
              <button
                className={rightPanelTab === "tokens" ? "is-active" : ""}
                type="button"
                role="tab"
                aria-selected={rightPanelTab === "tokens"}
                onClick={() => setRightPanelTab("tokens")}
              >
                Tokens
              </button>
            </div>
          </div>

          {rightPanelTab === "tokens" ? (
            <TokenEditor tokens={tokens} onChange={updateTokenValue} />
          ) : selectedComponent ? (
            <div className="property-list">
              <button className="danger-button" type="button" onClick={deleteSelectedComponent}>
                <Trash2 size={16} aria-hidden="true" />
                <span>Delete component</span>
              </button>
              <TextInput label="id" value={selectedComponent.id} onChange={updateSelectedId} />
              <ReadOnlyField label="type" value={selectedComponent.type} />
              <TextInput
                label="label"
                value={selectedComponent.label}
                onChange={(value) => updateSelected((component) => ({ ...component, label: value }))}
              />

              <label className="field">
                <span>size unit</span>
                <select value={selectedComponent.size_unit ?? "px"} onChange={(event) => updateSizeUnit(event.target.value as SizeUnit)}>
                  <option value="px">px</option>
                  <option value="percent">%</option>
                </select>
              </label>

              <label className="field">
                <span>snap mode</span>
                <select value={selectedComponent.snap_mode ?? "canvas"} onChange={(event) => updateSnapMode(event.target.value as SnapMode)}>
                  {SNAP_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </label>

              <div className="field-grid">
                <NumberInput label="x" value={selectedComponent.position[0]} onChange={(value) => updatePosition(0, value)} />
                <NumberInput label="y" value={selectedComponent.position[1]} onChange={(value) => updatePosition(1, value)} />
                <NumberInput
                  label={`width (${selectedComponent.size_unit === "percent" ? "%" : "px"})`}
                  value={displaySizeValue(selectedComponent, 0, design.base_resolution)}
                  min={selectedComponent.size_unit === "percent" ? 1 : 8}
                  onChange={(value) => updateSize(0, value)}
                />
                <NumberInput
                  label={`height (${selectedComponent.size_unit === "percent" ? "%" : "px"})`}
                  value={displaySizeValue(selectedComponent, 1, design.base_resolution)}
                  min={selectedComponent.size_unit === "percent" ? 1 : 8}
                  onChange={(value) => updateSize(1, value)}
                />
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
              <label className="field">
                <span>parent_id</span>
                <select
                  value={selectedComponent.parent_id ?? ""}
                  onChange={(event) => updateComponentParent(selectedComponent.id, event.target.value)}
                >
                  <option value="">none</option>
                  {design.components
                    .filter((component) => canUseAsParent(selectedComponent.id, component.id, design.components))
                    .map((component) => (
                      <option key={component.id} value={component.id}>
                        {component.id}
                      </option>
                    ))}
                </select>
              </label>
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
  tokens,
  selected,
  onPointerDown,
  onResizePointerDown,
}: {
  component: UIComponent;
  tokens: TokenDocument;
  selected: boolean;
  onPointerDown: (event: React.PointerEvent) => void;
  onResizePointerDown: (event: React.PointerEvent, handle: ResizeHandle) => void;
}) {
  const Icon = componentIcons[component.type];
  const accent = getComponentAccent(tokens, component);
  return (
    <div
      className={`wire-component wire-${component.type.toLowerCase()}${selected ? " is-selected" : ""}`}
      style={{
        left: component.position[0],
        top: component.position[1],
        width: component.size[0],
        height: component.size[1],
        zIndex: component.z_index,
        "--component-accent": accent,
      } as CSSProperties}
      onPointerDown={onPointerDown}
      title={`${component.id} / ${component.type}`}
    >
      <div className="wire-header">
        <Icon size={18} aria-hidden="true" />
        <span>{component.label}</span>
      </div>
      {renderComponentBody(component)}
      <div className="wire-id">{component.id}</div>
      {selected
        ? RESIZE_HANDLES.map((handle) => (
            <span
              aria-hidden="true"
              className={`resize-handle resize-${handle}`}
              key={handle}
              onPointerDown={(event) => onResizePointerDown(event, handle)}
            />
          ))
        : null}
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

function ComponentListItem({
  component,
  components,
  depth,
  selected,
  dragging,
  onSelect,
  onDragStart,
  onDragEnd,
  onNestDrop,
  onParentChange,
}: {
  component: UIComponent;
  components: UIComponent[];
  depth: number;
  selected: boolean;
  dragging: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onNestDrop: () => void;
  onParentChange: (parentId: string) => void;
}) {
  return (
    <div
      className={`component-list-item${selected ? " is-selected" : ""}${dragging ? " is-dragging" : ""}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", component.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      style={{ paddingLeft: 8 + depth * 12 }}
    >
      <button className="component-select-button" type="button" onClick={onSelect} title={`Select ${component.id}`}>
        <span className="component-list-id">{component.id}</span>
        <span className="component-list-type">{component.type}</span>
      </button>
      {component.type === "Panel" ? (
        <div className="component-drop-row">
          <button
            type="button"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              onNestDrop();
            }}
          >
            Nest
          </button>
        </div>
      ) : null}
      <div className="component-list-controls">
        <select
          aria-label={`${component.id} parent`}
          value={component.parent_id ?? ""}
          onChange={(event) => onParentChange(event.target.value)}
        >
          <option value="">parent none</option>
          {components
            .filter((item) => canUseAsParent(component.id, item.id, components))
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.id}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}

function TokenEditor({
  tokens,
  onChange,
}: {
  tokens: TokenDocument;
  onChange: (category: keyof TokenDocument, key: string, value: string) => void;
}) {
  const categories = Object.entries(tokens) as Array<[keyof TokenDocument, Record<string, string | number>]>;

  return (
    <div className="token-editor">
      {categories.map(([category, values]) => (
        <section className="token-section" key={category}>
          <div className="section-title">{category}</div>
          {Object.entries(values).map(([key, value]) => (
            <label className="token-row" key={key}>
              <span>{key}</span>
              <input
                type={typeof value === "number" ? "number" : "text"}
                value={String(value)}
                onChange={(event) => onChange(category, key, event.target.value)}
              />
            </label>
          ))}
        </section>
      ))}
    </div>
  );
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
  max,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      className="resolution-input"
      aria-label={label}
      type="number"
      min={min}
      max={max}
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

function getMaxSafeArea(baseResolution: [number, number]): number {
  return Math.floor(Math.min(baseResolution[0], baseResolution[1]) / 2);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function sortComponentsForCanvas(components: UIComponent[]): UIComponent[] {
  return components.slice().sort((a, b) => a.z_index - b.z_index);
}

function buildChildComponentMap(components: UIComponent[]): Map<string, UIComponent[]> {
  const childMap = new Map<string, UIComponent[]>();
  components.forEach((component) => {
    if (!component.parent_id) return;
    const siblings = childMap.get(component.parent_id) ?? [];
    siblings.push(component);
    childMap.set(component.parent_id, siblings);
  });
  return childMap;
}

function orderComponentsForList(components: UIComponent[]): UIComponent[] {
  const sorted = sortComponentsForCanvas(components);
  const componentIds = new Set(sorted.map((component) => component.id));
  const childMap = buildChildComponentMap(sorted);
  const ordered: UIComponent[] = [];
  const visited = new Set<string>();

  const visit = (component: UIComponent) => {
    if (visited.has(component.id)) return;
    visited.add(component.id);
    ordered.push(component);
    (childMap.get(component.id) ?? []).forEach(visit);
  };

  sorted.filter((component) => !component.parent_id || !componentIds.has(component.parent_id)).forEach(visit);
  sorted.forEach(visit);
  return ordered;
}

function getMoveBounds(
  size: [number, number],
  baseResolution: [number, number],
  snapMode: SnapMode,
  safeArea: number,
) {
  const limits = getSnapFrameLimits(baseResolution, snapMode, safeArea);
  if (limits) {
    return {
      minX: limits.minX,
      minY: limits.minY,
      maxX: Math.max(limits.minX, limits.maxX - size[0]),
      maxY: Math.max(limits.minY, limits.maxY - size[1]),
    };
  }

  return {
    minX: -size[0] + 8,
    minY: -size[1] + 8,
    maxX: baseResolution[0] - 8,
    maxY: baseResolution[1] - 8,
  };
}

function getSnapFrameLimits(
  baseResolution: [number, number],
  snapMode: SnapMode,
  safeArea: number,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (snapMode === "none") return null;
  if (snapMode === "padding") {
    const inset = clamp(Math.round(safeArea), 0, getMaxSafeArea(baseResolution));
    return {
      minX: inset,
      minY: inset,
      maxX: Math.max(inset, baseResolution[0] - inset),
      maxY: Math.max(inset, baseResolution[1] - inset),
    };
  }

  return {
    minX: 0,
    minY: 0,
    maxX: baseResolution[0],
    maxY: baseResolution[1],
  };
}

function getResizedFrame(
  state: ResizeState,
  point: CanvasPoint,
  baseResolution: [number, number],
  snapMode: SnapMode,
  safeArea: number,
): { position: [number, number]; size: [number, number] } {
  const minSize = 8;
  const limits = getSnapFrameLimits(baseResolution, snapMode, safeArea);
  const dx = point.x - state.startPoint.x;
  const dy = point.y - state.startPoint.y;
  let left = state.startPosition[0];
  let top = state.startPosition[1];
  let right = state.startPosition[0] + state.startSize[0];
  let bottom = state.startPosition[1] + state.startSize[1];

  if (state.handle.includes("w")) left += dx;
  if (state.handle.includes("e")) right += dx;
  if (state.handle.includes("n")) top += dy;
  if (state.handle.includes("s")) bottom += dy;

  if (right - left < minSize) {
    if (state.handle.includes("w")) left = right - minSize;
    else right = left + minSize;
  }

  if (bottom - top < minSize) {
    if (state.handle.includes("n")) top = bottom - minSize;
    else bottom = top + minSize;
  }

  if (limits) {
    left = clamp(left, limits.minX, Math.max(limits.minX, limits.maxX - minSize));
    top = clamp(top, limits.minY, Math.max(limits.minY, limits.maxY - minSize));
    right = clamp(right, left + minSize, Math.max(left + minSize, limits.maxX));
    bottom = clamp(bottom, top + minSize, Math.max(top + minSize, limits.maxY));
  }

  let width = clamp(right - left, minSize, limits ? Math.max(minSize, limits.maxX - limits.minX) : baseResolution[0] * 2);
  let height = clamp(bottom - top, minSize, limits ? Math.max(minSize, limits.maxY - limits.minY) : baseResolution[1] * 2);
  let x = Math.round(left);
  let y = Math.round(top);

  if (!limits) {
    x = clamp(x, -width + 8, baseResolution[0] - 8);
    y = clamp(y, -height + 8, baseResolution[1] - 8);
  }

  width = Math.round(width);
  height = Math.round(height);
  return { position: [x, y], size: [width, height] };
}

function sizeToPercent(size: [number, number], baseResolution: [number, number]): [number, number] {
  return [roundToTwo((size[0] / baseResolution[0]) * 100), roundToTwo((size[1] / baseResolution[1]) * 100)];
}

function displaySizeValue(component: UIComponent, axis: 0 | 1, baseResolution: [number, number]): number {
  if ((component.size_unit ?? "px") !== "percent") return component.size[axis];
  return roundToTwo((component.size[axis] / baseResolution[axis]) * 100);
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function componentDepth(component: UIComponent, components: UIComponent[]): number {
  let depth = 0;
  let parentId = component.parent_id;
  const visited = new Set<string>([component.id]);

  while (parentId && !visited.has(parentId)) {
    const parent = components.find((item) => item.id === parentId);
    if (!parent) break;
    depth += 1;
    visited.add(parent.id);
    parentId = parent.parent_id;
  }

  return Math.min(depth, 6);
}

function canNestUnder(childId: string, parentId: string, components: UIComponent[]): boolean {
  if (!parentId || childId === parentId) return false;
  let cursor: string | undefined = parentId;
  const visited = new Set<string>();

  while (cursor) {
    if (cursor === childId) return false;
    if (visited.has(cursor)) return false;
    visited.add(cursor);
    cursor = components.find((component) => component.id === cursor)?.parent_id;
  }

  return true;
}

function canUseAsParent(childId: string, parentId: string, components: UIComponent[]): boolean {
  const parent = components.find((component) => component.id === parentId);
  return parent?.type === "Panel" && canNestUnder(childId, parentId, components);
}

function getTokenColor(tokens: TokenDocument, key: string): string | null {
  return tokens.colors[key] ?? null;
}

function getComponentAccent(tokens: TokenDocument, component: UIComponent): string {
  const styleToken = getTokenColor(tokens, component.style_token);
  if (styleToken) return styleToken;
  if (component.type === "ResourceCounter" || component.type === "SkillSlot" || component.type === "Button") {
    return getTokenColor(tokens, "gold") ?? "#f2b84b";
  }
  if (component.type === "StatusEffectList") {
    return getTokenColor(tokens, "status_buff") ?? "#59d6c9";
  }
  return getTokenColor(tokens, "selected") ?? "#58a6ff";
}

function buildTokenStyle(tokens: TokenDocument): CSSProperties {
  const style: Record<string, string | number> = {
    "--token-canvas-bg": tokens.colors.canvas_bg,
    "--token-panel-bg": tokens.colors.panel_bg,
    "--token-panel-border": tokens.colors.panel_border,
    "--token-text-primary": tokens.colors.text_primary,
    "--token-text-muted": tokens.colors.text_muted,
    "--token-selected": tokens.colors.selected,
    "--token-gold": tokens.colors.gold,
    "--token-status-buff": tokens.colors.status_buff,
    "--token-status-debuff": tokens.colors.status_debuff,
    "--token-font-ui": String(tokens.fonts.ui),
    "--token-font-mono": String(tokens.fonts.mono),
    "--token-font-base-size": `${tokens.fonts.base_size}px`,
    "--token-radius-sm": `${tokens.radius.sm}px`,
    "--token-radius-md": `${tokens.radius.md}px`,
    "--token-radius-lg": `${tokens.radius.lg}px`,
    "--token-shadow-focus": tokens.shadows.focus,
    "--token-shadow-overlay": tokens.shadows.overlay,
  };

  return style as CSSProperties;
}
