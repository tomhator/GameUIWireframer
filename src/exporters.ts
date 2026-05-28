import YAML from "yaml";
import type { DesignDocument, Flow, FlowDocument, TokenDocument } from "./types";

export function buildDesignYaml(design: DesignDocument): string {
  return YAML.stringify(
    {
      screen: design.screen,
      base_resolution: design.base_resolution,
      safe_area: design.safe_area,
      components: design.components.map((component) => ({
        id: component.id,
        type: component.type,
        label: component.label,
        anchor: component.anchor,
        position: component.position,
        size: component.size,
        size_unit: component.size_unit ?? "px",
        snap_mode: component.snap_mode ?? "canvas",
        ...(component.size_unit === "percent"
          ? {
              size_percent: [
                roundPercent((component.size[0] / design.base_resolution[0]) * 100),
                roundPercent((component.size[1] / design.base_resolution[1]) * 100),
              ],
            }
          : {}),
        z_index: component.z_index,
        parent_id: component.parent_id || undefined,
        prompt: component.prompt || undefined,
        material_icon: component.material_icon || undefined,
        panel_title_bg: component.panel_title_bg || undefined,
        panel_title_color: component.panel_title_color || undefined,
        style_token: component.style_token,
        data_binding: component.data_binding,
        states: component.states,
        interactions: component.interactions,
        responsive_rule: component.responsive_rule,
      })),
    },
    { lineWidth: 0 },
  );
}

export function buildTokensYaml(tokens: TokenDocument): string {
  return YAML.stringify(tokens, { lineWidth: 0 });
}

export function buildFlowsYaml(design: DesignDocument, baseFlows: FlowDocument): string {
  const byKey = new Map<string, Flow>();

  baseFlows.flows.forEach((flow) => {
    byKey.set(flowKey(flow), flow);
  });

  design.components.forEach((component) => {
    component.interactions.forEach((interaction) => {
      if (!interaction.action) return;
      const flow: Flow = {
        trigger: interaction.trigger || `${component.id}.interact`,
        action: interaction.action,
        params: interaction.params,
        keyboard_input: interaction.keyboard_input || undefined,
        gamepad_input: interaction.gamepad_input || undefined,
      };
      byKey.set(flowKey(flow), flow);
    });
  });

  return YAML.stringify({ flows: Array.from(byKey.values()) }, { lineWidth: 0 });
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/yaml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function flowKey(flow: Flow): string {
  return `${flow.trigger}:${flow.action}`;
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}
