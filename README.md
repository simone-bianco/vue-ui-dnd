# @simone-bianco/vue-ui-dnd

Framework-neutral Vue 3 drag-and-drop primitives backed by Pragmatic Drag and Drop.

The package intentionally exposes its own Vue contract and does not leak the underlying drag engine to consumers.

## SortableList

`SortableList` owns reorder mechanics only. The consumer owns item rendering, application state, persistence, and domain behavior.

```vue
<script setup lang="ts">
import { SortableList } from "@simone-bianco/vue-ui-dnd";
import "@simone-bianco/vue-ui-dnd/style.css";

const items = ref([
  { id: 1, title: "Tools Definitions" },
  { id: 2, title: "Package Expertise" },
]);
</script>

<template>
  <SortableList
    v-model="items"
    item-key="id"
    :get-item-label="(item) => item.title"
    @reorder="(event) => console.log(event.fromIndex, event.toIndex)"
  >
    <template #handle>
      <span aria-hidden="true">Drag</span>
    </template>

    <template #item="{ item, dragging, dropPosition }">
      <div
        :data-dragging="dragging || undefined"
        :data-drop-position="dropPosition || undefined"
      >
        {{ item.title }}
      </div>
    </template>

    <template #empty>No items.</template>
  </SortableList>
</template>
```

### Contract

- `v-model`: ordered item array; reorder is local and synchronous.
- `item-key`: required stable string/number property or resolver function.
- `orientation`: `vertical` (default) or `horizontal`.
- `disabled`: disables all dragging.
- `animated`: animates item position changes after pointer drops, keyboard moves and model reorders (default `true`). Uses Vue `TransitionGroup` without extra DOM wrappers or animation dependencies. The package stylesheet disables movement for `prefers-reduced-motion: reduce`; set `:animated="false"` to opt out per list. Hovering during a drag still shows the insertion marker; it does not mutate the model.
- `use-handle`: use the built-in accessible handle (default) or make the whole item draggable.
- `can-drag`: optional per-item guard.
- `get-item-label`: supplies the accessible handle label.
- `tag` / `item-tag`: customize rendered container elements.
- `ui`: class overrides for `root`, `item`, `itemDragging`, `itemDropTarget`, `handle`, `content`, `empty`.
- slots: `before`, `handle`, `item`, `empty`, `after`.
- `reorder`: emits the moved item, stable key, old/new indexes, resulting array, and pointer/keyboard method.

The built-in handle also supports keyboard reorder: Arrow Up/Down for vertical lists, Arrow Left/Right for horizontal lists, plus Home/End.

Persistence is intentionally outside this package.

With `useHandle` (default), only the handle is registered as the native draggable; the row remains the drop target and drag preview. Text and controls in the content area remain normally selectable/interactive without holding Alt. With `useHandle=false`, the whole row is intentionally draggable.

## Element-local external drag/drop

For cross-component drag/drop, use `useDragSource` and `useDropTarget`. They keep Pragmatic Drag and Drop private to this package and register only the supplied elements; no consumer-level global monitor is required.

```ts
const source = ref<HTMLElement | null>(null);
const target = ref<HTMLElement | null>(null);

useDragSource({
  element: source,
  type: "flow-node",
  data: { kind: "wait" },
});

useDropTarget<{ kind: string }>({
  element: target,
  accept: "flow-node",
  onDrop: ({ data, clientX, clientY }) => {
    console.log(data.kind, clientX, clientY);
  },
});
```

Both composables clean up when their element ref changes, when disabled, and when the owning Vue scope unmounts. `useDropTarget` normalizes drops to `{ type, data, clientX, clientY }`; application coordinate conversion remains the consumer's responsibility.
