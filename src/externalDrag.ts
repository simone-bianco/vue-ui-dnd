import type { ExternalDragEnvelope } from "./types";

export const EXTERNAL_DRAG_MARKER = "vue-ui-dnd-external";

export function isExternalDragEnvelope(
  data: Record<string | symbol, unknown>,
): data is Record<string | symbol, unknown> & ExternalDragEnvelope<unknown> {
  return (
    data.kind === EXTERNAL_DRAG_MARKER &&
    typeof data.type === "string" &&
    data.type.length > 0 &&
    "payload" in data
  );
}
