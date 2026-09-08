import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { onScopeDispose, toValue, watch } from "vue";
import { isExternalDragEnvelope } from "../externalDrag";
import type { DropTargetOptions } from "../types";

function accepts(accepted: string | readonly string[], type: string): boolean {
  return Array.isArray(accepted) ? accepted.includes(type) : accepted === type;
}

export function useDropTarget<T>(options: DropTargetOptions<T>): void {
  let cleanup: (() => void) | null = null;

  const stop = watch(
    () =>
      [toValue(options.element), toValue(options.disabled ?? false)] as const,
    ([element, disabled]) => {
      cleanup?.();
      cleanup = null;

      if (!element || disabled) return;

      cleanup = dropTargetForElements({
        element,
        canDrop: ({ source }) =>
          !toValue(options.disabled ?? false) &&
          isExternalDragEnvelope(source.data) &&
          accepts(options.accept, source.data.type),
        onDrop: ({ source, location }) => {
          if (
            toValue(options.disabled ?? false) ||
            !isExternalDragEnvelope(source.data) ||
            !accepts(options.accept, source.data.type)
          ) {
            return;
          }

          const input = location.current.input;
          options.onDrop({
            type: source.data.type,
            data: source.data.payload as T,
            clientX: input.clientX,
            clientY: input.clientY,
          });
        },
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
