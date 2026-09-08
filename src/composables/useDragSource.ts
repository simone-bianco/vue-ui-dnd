import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { onScopeDispose, toValue, watch } from "vue";
import { EXTERNAL_DRAG_MARKER } from "../externalDrag";
import type { DragSourceOptions, ExternalDragEnvelope } from "../types";

export function useDragSource<T>(options: DragSourceOptions<T>): void {
  let cleanup: (() => void) | null = null;

  const stop = watch(
    () =>
      [toValue(options.element), toValue(options.disabled ?? false)] as const,
    ([element, disabled]) => {
      cleanup?.();
      cleanup = null;

      if (!element || disabled) return;

      cleanup = draggable({
        element,
        canDrag: () => !toValue(options.disabled ?? false),
        getInitialData: () =>
          ({
            kind: EXTERNAL_DRAG_MARKER,
            type: options.type,
            payload: toValue(options.data),
          }) satisfies ExternalDragEnvelope<T>,
      });
    },
    { immediate: true, flush: "post" },
  );

  onScopeDispose(() => {
    stop();
    cleanup?.();
    cleanup = null;
  });
}
