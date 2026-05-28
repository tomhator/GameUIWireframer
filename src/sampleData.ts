import type {
  ComponentInteraction,
  ComponentType,
  DesignDocument,
  FlowDocument,
  TokenDocument,
  UIComponent,
} from "./types";

export const defaultTokens: TokenDocument = {
  colors: {
    canvas_bg: "#10141c",
    panel_bg: "#222936",
    panel_border: "#435066",
    text_primary: "#f4f7fb",
    text_muted: "#9ba8ba",
    hp_bar: "#28c76f",
    hp_bar_low: "#ff4d5e",
    enemy_hp: "#e35d5b",
    mana: "#3ba7ff",
    gold: "#f2b84b",
    status_buff: "#59d6c9",
    status_debuff: "#d778ff",
    selected: "#58a6ff",
  },
  fonts: {
    ui: "Inter, system-ui, sans-serif",
    mono: "JetBrains Mono, SFMono-Regular, monospace",
    base_size: 14,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  radius: {
    sm: 4,
    md: 6,
    lg: 8,
  },
  shadows: {
    focus: "0 0 0 2px rgba(88, 166, 255, 0.55)",
    overlay: "0 16px 48px rgba(0, 0, 0, 0.35)",
  },
};

const responsiveRule = {
  mode: "scale_with_canvas" as const,
  behavior: "preserve_anchor_and_relative_position",
};

export const defaultFlowDocument: FlowDocument = {
  flows: [
    {
      trigger: "skill_bar.slot.click",
      action: "use_skill",
      params: {
        skill_id: "bound_skill",
      },
      keyboard_input: "1-5",
      gamepad_input: "face_buttons",
    },
    {
      trigger: "minimap.click",
      action: "open_map",
    },
  ],
};

export const sampleDesign: DesignDocument = {
  screen: "combat_hud",
  base_resolution: [1920, 1080],
  safe_area: 64,
  components: [
    {
      id: "player_hp",
      type: "ProgressBar",
      label: "Player HP",
      anchor: "bottom_left",
      position: [64, 940],
      size: [420, 32],
      z_index: 10,
      style_token: "hp_bar",
      data_binding: "player.hp / player.max_hp",
      states: {
        low: {
          condition: "player.hp < 0.25",
          style_token: "hp_bar_low",
        },
      },
      interactions: [],
      responsive_rule: responsiveRule,
    },
    {
      id: "enemy_hp",
      type: "ProgressBar",
      label: "Enemy HP",
      anchor: "top_center",
      position: [720, 64],
      size: [480, 28],
      z_index: 10,
      style_token: "enemy_hp",
      data_binding: "target.hp / target.max_hp",
      states: {
        broken: {
          condition: "target.part_broken == true",
          style_token: "enemy_hp",
        },
      },
      interactions: [],
      responsive_rule: responsiveRule,
    },
    {
      id: "skill_bar",
      type: "Panel",
      label: "Skill Bar",
      anchor: "bottom_center",
      position: [640, 972],
      size: [640, 72],
      z_index: 20,
      style_token: "skill_bar",
      data_binding: "player.equipped_skills",
      states: {},
      interactions: [
        {
          trigger: "skill_bar.slot.click",
          action: "use_skill",
          keyboard_input: "1-5",
          gamepad_input: "face_buttons",
          params: {
            skill_id: "bound_skill",
          },
        },
      ],
      responsive_rule: responsiveRule,
    },
    {
      id: "resource_counter",
      type: "ResourceCounter",
      label: "Energy",
      anchor: "bottom_left",
      position: [64, 888],
      size: [220, 40],
      z_index: 12,
      style_token: "resource_counter",
      data_binding: "player.energy",
      states: {},
      interactions: [],
      responsive_rule: responsiveRule,
    },
    {
      id: "minimap",
      type: "Minimap",
      label: "Minimap",
      anchor: "top_right",
      position: [1656, 64],
      size: [200, 200],
      z_index: 15,
      style_token: "minimap",
      data_binding: "world.visible_map",
      states: {},
      interactions: [
        {
          trigger: "minimap.click",
          action: "open_map",
        },
      ],
      responsive_rule: responsiveRule,
    },
    {
      id: "status_effect_list",
      type: "StatusEffectList",
      label: "Status Effects",
      anchor: "bottom_left",
      position: [64, 832],
      size: [320, 40],
      z_index: 14,
      style_token: "status_effect_list",
      data_binding: "player.status_effects",
      states: {},
      interactions: [],
      responsive_rule: responsiveRule,
    },
  ],
};

const defaultSizes: Record<ComponentType, [number, number]> = {
  Panel: [360, 160],
  Button: [180, 52],
  IconButton: [56, 56],
  ProgressBar: [320, 30],
  ResourceCounter: [220, 42],
  InventoryGrid: [320, 320],
  SkillSlot: [72, 72],
  Tooltip: [260, 96],
  Modal: [560, 360],
  TabGroup: [420, 64],
  DialogueBox: [720, 160],
  QuestTracker: [320, 240],
  Minimap: [200, 200],
  StatusEffectList: [300, 44],
  EquipmentSlot: [84, 84],
};

const defaultBinding: Partial<Record<ComponentType, string>> = {
  Button: "ui.action",
  IconButton: "ui.icon_action",
  ProgressBar: "entity.value / entity.max_value",
  ResourceCounter: "player.resource",
  InventoryGrid: "player.inventory",
  SkillSlot: "player.skill",
  Tooltip: "ui.tooltip",
  Modal: "ui.modal_state",
  TabGroup: "ui.active_tab",
  DialogueBox: "dialogue.current_line",
  QuestTracker: "player.active_quests",
  Minimap: "world.visible_map",
  StatusEffectList: "entity.status_effects",
  EquipmentSlot: "player.equipment.slot",
};

const clickableTypes = new Set<ComponentType>([
  "Button",
  "IconButton",
  "SkillSlot",
  "TabGroup",
  "Minimap",
  "EquipmentSlot",
]);

export function createComponent(type: ComponentType, index: number): UIComponent {
  const idBase = toSnakeCase(type);
  const id = `${idBase}_${index}`;
  const size = defaultSizes[type];
  const interaction: ComponentInteraction = {
    trigger: `${id}.click`,
    action: defaultAction(type),
  };

  return {
    id,
    type,
    label: readableLabel(type),
    anchor: "top_left",
    position: [120 + (index % 8) * 24, 120 + (index % 6) * 20],
    size,
    size_unit: "px",
    z_index: 10 + index,
    style_token: idBase,
    data_binding: defaultBinding[type] ?? "",
    states:
      type === "ProgressBar"
        ? {
            low: {
              condition: "value < 0.25",
              style_token: `${idBase}_low`,
            },
          }
        : {},
    interactions: clickableTypes.has(type) ? [interaction] : [],
    responsive_rule: responsiveRule,
  };
}

function defaultAction(type: ComponentType): string {
  if (type === "SkillSlot") return "use_skill";
  if (type === "Minimap") return "open_map";
  if (type === "TabGroup") return "switch_tab";
  if (type === "EquipmentSlot") return "inspect_equipment";
  return "activate";
}

function readableLabel(type: ComponentType): string {
  return type.replace(/([A-Z])/g, " $1").trim();
}

function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .toLowerCase();
}
