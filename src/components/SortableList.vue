<script setup lang="ts" generic="T">
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  TransitionGroup,
  watch,
} from "vue";
import type {
  SortableDropPosition,
  SortableKey,
  SortableListProps,
  SortableReorderEvent,
} from "../types";

interface RegisteredItem {
  element: HTMLElement | null;
  handle: HTMLElement | null;
  cleanup: (() => void) | null;
}

interface DragData {
  type: "vue-ui-dnd-sortable-item";
  listId: string;
  key: SortableKey;
}

const props = withDefaults(defineProps<SortableListProps<T>>(), {
  orientation: "vertical",
  disabled: false,
  animated: true,
  useHandle: true,
  tag: "div",
  itemTag: "div",
  ariaLabel: "Sortable list",
  getItemLabel: undefined,
  canDrag: undefined,
  ui: () => ({}),
});

const emit = defineEmits<{
  reorder: [event: SortableReorderEvent<T>];
}>();

const items = defineModel<T[]>({ required: true });
const listId = `sortable-${Math.random().toString(36).slice(2)}`;
const registrations = new Map<string, RegisteredItem>();
const draggingKey = ref<string | null>(null);
const dropPositions = reactive(new Map<string, SortableDropPosition>());
let cleanupMonitor: (() => void) | null = null;

const rootClasses = computed(() => ["vue-ui-sortable-list", props.ui.root]);

function serializeKey(key: SortableKey): string {
  return `${typeof key}:${String(key)}`;
}

function resolveKey(item: T, index: number): SortableKey {
  if (typeof props.itemKey === "function") {
    return props.itemKey(item, index);
  }

  const value = item[props.itemKey];
  if (typeof value !== "string" && typeof value !== "number") {
    throw new TypeError(
      "SortableList itemKey must resolve to a string or number.",
    );
  }

  return value;
}

function resolveIndex(key: SortableKey): number {
  const serialized = serializeKey(key);
  return items.value.findIndex(
    (item, index) => serializeKey(resolveKey(item, index)) === serialized,
  );
}

function itemCanDrag(item: T, index: number): boolean {
  return !props.disabled && (props.canDrag?.(item, index) ?? true);
}

function itemLabel(item: T, index: number): string {
  return props.getItemLabel?.(item, index) ?? `item ${index + 1}`;
}

function handleAriaLabel(item: T, index: number): string {
  return `Reorder ${itemLabel(item, index)}`;
}

function isDragData(
  data: Record<string, unknown>,
): data is Record<string, unknown> & DragData {
  return data.type === "vue-ui-dnd-sortable-item" && data.listId === listId;
}

function computeDropPosition(
  element: HTMLElement,
  clientX: number,
  clientY: number,
): Exclude<SortableDropPosition, null> {
  const rect = element.getBoundingClientRect();
  if (props.orientation === "horizontal") {
    return clientX < rect.left + rect.width / 2 ? "before" : "after";
  }

  return clientY < rect.top + rect.height / 2 ? "before" : "after";
}

function clearDropState(): void {
  dropPositions.clear();
}

function reorder(
  fromIndex: number,
  rawToIndex: number,
  method: "pointer" | "keyboard",
): void {
  if (
    fromIndex < 0 ||
    fromIndex >= items.value.length ||
    rawToIndex < 0 ||
    rawToIndex >= items.value.length
  ) {
    return;
  }

  if (fromIndex === rawToIndex) {
    return;
  }

  const next = [...items.value];
  const [item] = next.splice(fromIndex, 1);
  if (item === undefined) {
    return;
  }

  next.splice(rawToIndex, 0, item);
  const key = resolveKey(item, rawToIndex);
  items.value = next;
  emit("reorder", {
    item,
    key,
    fromIndex,
    toIndex: rawToIndex,
    items: next,
    method,
  });
}

function reorderFromDrop(
  sourceKey: SortableKey,
  targetKey: SortableKey,
  position: Exclude<SortableDropPosition, null>,
): void {
  const fromIndex = resolveIndex(sourceKey);
  const targetIndex = resolveIndex(targetKey);
  if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) {
    return;
  }

  let insertionIndex = targetIndex + (position === "after" ? 1 : 0);
  if (fromIndex < insertionIndex) {
    insertionIndex -= 1;
  }

  reorder(
    fromIndex,
    Math.max(0, Math.min(insertionIndex, items.value.length - 1)),
    "pointer",
  );
}

function registerItem(serializedKey: string): void {
  const registration = registrations.get(serializedKey);
  if (!registration?.element) {
    return;
  }

  registration.cleanup?.();

  const element = registration.element;
  const handle = props.useHandle
    ? (registration.handle ?? undefined)
    : undefined;
  if (props.useHandle && !handle) return;

  registration.cleanup = combine(
    draggable({
      // Native draggable ancestors prevent normal mouse text selection.
      // In handle mode only the handle is draggable; the row remains the drop target.
      element: handle ?? element,
      onGenerateDragPreview: ({ nativeSetDragImage, location }) => {
        if (!handle) return;
        const rect = element.getBoundingClientRect();
        nativeSetDragImage?.(
          element,
          location.current.input.clientX - rect.left,
          location.current.input.clientY - rect.top,
        );
      },
      canDrag: () => {
        const currentIndex = items.value.findIndex(
          (item, index) =>
            serializeKey(resolveKey(item, index)) === serializedKey,
        );
        const currentItem = items.value[currentIndex];
        return (
          currentIndex >= 0 &&
          currentItem !== undefined &&
          itemCanDrag(currentItem, currentIndex)
        );
      },
      getInitialData: () => {
        const index = items.value.findIndex(
          (item, itemIndex) =>
            serializeKey(resolveKey(item, itemIndex)) === serializedKey,
        );
        const item = items.value[index];
        if (index < 0 || item === undefined) {
          return {
            type: "vue-ui-dnd-sortable-item",
            listId,
            key: serializedKey,
          };
        }

        return {
          type: "vue-ui-dnd-sortable-item",
          listId,
          key: resolveKey(item, index),
        } satisfies DragData;
      },
      onDragStart: ({ source }) => {
        if (isDragData(source.data)) {
          draggingKey.value = serializeKey(source.data.key);
        }
      },
    }),
    dropTargetForElements({
      element,
      canDrop: ({ source }) => isDragData(source.data),
      getData: () => {
        const index = items.value.findIndex(
          (item, itemIndex) =>
            serializeKey(resolveKey(item, itemIndex)) === serializedKey,
        );
        const item = items.value[index];
        return {
          type: "vue-ui-dnd-sortable-item",
          listId,
          key: item === undefined ? serializedKey : resolveKey(item, index),
        } satisfies DragData;
      },
      onDrag: ({ location, self, source }) => {
        if (!isDragData(source.data) || !isDragData(self.data)) {
          return;
        }

        if (serializeKey(source.data.key) === serializeKey(self.data.key)) {
          dropPositions.delete(serializedKey);
          return;
        }

        dropPositions.set(
          serializedKey,
          computeDropPosition(
            element,
            location.current.input.clientX,
            location.current.input.clientY,
          ),
        );
      },
      onDragLeave: () => {
        dropPositions.delete(serializedKey);
      },
    }),
  );
}

function setItemElement(key: SortableKey, value: unknown): void {
  const serializedKey = serializeKey(key);
  const element = value instanceof HTMLElement ? value : null;
  const existing = registrations.get(serializedKey) ?? {
    element: null,
    handle: null,
    cleanup: null,
  };

  if (existing.element === element) {
    return;
  }

  existing.cleanup?.();
  existing.cleanup = null;
  existing.element = element;
  registrations.set(serializedKey, existing);

  if (element) {
    void nextTick(() => registerItem(serializedKey));
  }
}

function setHandleElement(key: SortableKey, value: unknown): void {
  const serializedKey = serializeKey(key);
  const element = value instanceof HTMLElement ? value : null;
  const existing = registrations.get(serializedKey) ?? {
    element: null,
    handle: null,
    cleanup: null,
  };

  if (existing.handle === element) {
    return;
  }

  existing.handle = element;
  registrations.set(serializedKey, existing);

  if (existing.element) {
    void nextTick(() => registerItem(serializedKey));
  }
}

function cleanupMissingRegistrations(): void {
  const activeKeys = new Set(
    items.value.map((item, index) => serializeKey(resolveKey(item, index))),
  );
  for (const [key, registration] of registrations) {
    if (!activeKeys.has(key)) {
      registration.cleanup?.();
      registrations.delete(key);
      dropPositions.delete(key);
    }
  }
}

function reregisterAll(): void {
  for (const key of registrations.keys()) {
    registerItem(key);
  }
}

function moveByKeyboard(item: T, index: number, event: KeyboardEvent): void {
  if (!itemCanDrag(item, index)) {
    return;
  }

  const previousKey =
    props.orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
  const nextKey =
    props.orientation === "horizontal" ? "ArrowRight" : "ArrowDown";

  let targetIndex: number | null = null;
  if (event.key === previousKey) {
    targetIndex = index - 1;
  } else if (event.key === nextKey) {
    targetIndex = index + 1;
  } else if (event.key === "Home") {
    targetIndex = 0;
  } else if (event.key === "End") {
    targetIndex = items.value.length - 1;
  }

  if (
    targetIndex === null ||
    targetIndex < 0 ||
    targetIndex >= items.value.length ||
    targetIndex === index
  ) {
    return;
  }

  event.preventDefault();
  reorder(index, targetIndex, "keyboard");
}

watch(
  () =>
    [
      props.disabled,
      props.useHandle,
      props.orientation,
      props.canDrag,
    ] as const,
  () => void nextTick(reregisterAll),
);

watch(items, () => void nextTick(cleanupMissingRegistrations), { deep: false });

onMounted(() => {
  cleanupMonitor = monitorForElements({
    canMonitor: ({ source }) => isDragData(source.data),
    onDrop: ({ source, location }) => {
      if (!isDragData(source.data)) {
        return;
      }

      const target = location.current.dropTargets.find((candidate) =>
        isDragData(candidate.data),
      );
      if (target && isDragData(target.data)) {
        const targetSerializedKey = serializeKey(target.data.key);
        const position = dropPositions.get(targetSerializedKey);
        if (position) {
          reorderFromDrop(source.data.key, target.data.key, position);
        }
      }

      draggingKey.value = null;
      clearDropState();
    },
  });
});

onBeforeUnmount(() => {
  cleanupMonitor?.();
  for (const registration of registrations.values()) {
    registration.cleanup?.();
  }
  registrations.clear();
  clearDropState();
});
</script>

<template>
  <component
    :is="tag"
    :class="rootClasses"
    :data-orientation="orientation"
    :aria-label="ariaLabel"
  >
    <slot name="before" />

    <TransitionGroup
      v-if="items.length > 0"
      :css="animated"
      :move-class="
        animated ? 'vue-ui-sortable-list__move' : 'vue-ui-sortable-list__static'
      "
    >
      <component
        :is="itemTag"
        v-for="(item, index) in items"
        :key="serializeKey(resolveKey(item, index))"
        :ref="
          (element: unknown) => setItemElement(resolveKey(item, index), element)
        "
        :class="[
          'vue-ui-sortable-list__item',
          ui.item,
          draggingKey === serializeKey(resolveKey(item, index)) && [
            'vue-ui-sortable-list__item--dragging',
            ui.itemDragging,
          ],
          dropPositions.get(serializeKey(resolveKey(item, index))) && [
            'vue-ui-sortable-list__item--drop-target',
            ui.itemDropTarget,
          ],
        ]"
        :data-sortable-key="serializeKey(resolveKey(item, index))"
        :data-dragging="
          draggingKey === serializeKey(resolveKey(item, index)) || undefined
        "
        :data-drop-position="
          dropPositions.get(serializeKey(resolveKey(item, index))) || undefined
        "
        :tabindex="!useHandle && itemCanDrag(item, index) ? 0 : undefined"
        :aria-label="!useHandle ? handleAriaLabel(item, index) : undefined"
        @keydown="!useHandle && moveByKeyboard(item, index, $event)"
      >
        <button
          v-if="useHandle"
          :ref="
            (element: unknown) =>
              setHandleElement(resolveKey(item, index), element)
          "
          type="button"
          :class="['vue-ui-sortable-list__handle', ui.handle]"
          :disabled="!itemCanDrag(item, index)"
          :aria-label="handleAriaLabel(item, index)"
          @keydown="moveByKeyboard(item, index, $event)"
        >
          <slot
            name="handle"
            :item="item"
            :index="index"
            :key="resolveKey(item, index)"
            :dragging="draggingKey === serializeKey(resolveKey(item, index))"
            :drop-position="
              dropPositions.get(serializeKey(resolveKey(item, index))) ?? null
            "
            :draggable="itemCanDrag(item, index)"
            :aria-label="handleAriaLabel(item, index)"
          >
            <span aria-hidden="true">⋮⋮</span>
          </slot>
        </button>

        <div :class="['vue-ui-sortable-list__content', ui.content]">
          <slot
            name="item"
            :item="item"
            :index="index"
            :key="resolveKey(item, index)"
            :dragging="draggingKey === serializeKey(resolveKey(item, index))"
            :drop-position="
              dropPositions.get(serializeKey(resolveKey(item, index))) ?? null
            "
            :draggable="itemCanDrag(item, index)"
          />
        </div>
      </component>
    </TransitionGroup>

    <div v-else :class="['vue-ui-sortable-list__empty', ui.empty]">
      <slot name="empty" />
    </div>

    <slot name="after" />
  </component>
</template>
