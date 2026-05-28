export const COMPONENT_TYPES = [
  "Panel",
  "Button",
  "IconButton",
  "ProgressBar",
  "ResourceCounter",
  "InventoryGrid",
  "SkillSlot",
  "Tooltip",
  "Modal",
  "TabGroup",
  "DialogueBox",
  "QuestTracker",
  "Minimap",
  "StatusEffectList",
  "EquipmentSlot",
] as const;

export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const ANCHORS = [
  "top_left",
  "top_center",
  "top_right",
  "center_left",
  "center",
  "center_right",
  "bottom_left",
  "bottom_center",
  "bottom_right",
] as const;

export type Anchor = (typeof ANCHORS)[number];

export type Vec2 = [number, number];

export interface ComponentState {
  condition: string;
  style_token: string;
}

export interface ComponentInteraction {
  trigger: string;
  action: string;
  keyboard_input?: string;
  gamepad_input?: string;
  params?: Record<string, string>;
}

export interface ResponsiveRule {
  mode: "fixed" | "scale_with_canvas" | "reflow";
  behavior: string;
}

export interface UIComponent {
  id: string;
  type: ComponentType;
  label: string;
  anchor: Anchor;
  position: Vec2;
  size: Vec2;
  size_unit?: "px" | "percent";
  size_percent?: Vec2;
  snap_to_edges?: boolean;
  z_index: number;
  parent_id?: string;
  style_token: string;
  data_binding: string;
  states: Record<string, ComponentState>;
  interactions: ComponentInteraction[];
  responsive_rule: ResponsiveRule;
}

export interface DesignDocument {
  screen: string;
  base_resolution: Vec2;
  safe_area: number;
  components: UIComponent[];
}

export interface TokenDocument {
  colors: Record<string, string>;
  fonts: Record<string, string | number>;
  spacing: Record<string, number>;
  radius: Record<string, number>;
  shadows: Record<string, string>;
}

export interface Flow {
  trigger: string;
  action: string;
  params?: Record<string, string>;
  keyboard_input?: string;
  gamepad_input?: string;
}

export interface FlowDocument {
  flows: Flow[];
}
