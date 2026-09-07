import type { MaybeRefOrGetter } from "vue";

export type SortableKey = string | number;
export type SortableOrientation = "vertical" | "horizontal";
export type SortableDropPosition = "before" | "after" | null;

export type SortableItemKey<T> =
  keyof T | ((item: T, index: number) => SortableKey);

export interface SortableListProps<TItem> {
  itemKey: SortableItemKey<TItem>;
  orientation?: SortableOrientation;
  disabled?: boolean;
  useHandle?: boolean;
  tag?: string;
  itemTag?: string;
  ariaLabel?: string;
  getItemLabel?: (item: TItem, index: number) => string;
  canDrag?: (item: TItem, index: number) => boolean;
  ui?: Partial<SortableListUI>;
}

export interface SortableListUI {
  root: string;
  item: string;
  itemDragging: string;
  itemDropTarget: string;
  handle: string;
  content: string;
  empty: string;
}

export interface SortableReorderEvent<T> {
  item: T;
  key: SortableKey;
  fromIndex: number;
  toIndex: number;
  items: T[];
  method: "pointer" | "keyboard";
}

export interface SortableItemSlotProps<T> {
  item: T;
  index: number;
  key: SortableKey;
  dragging: boolean;
  dropPosition: SortableDropPosition;
  draggable: boolean;
}

export interface SortableHandleSlotProps<T> extends SortableItemSlotProps<T> {
  ariaLabel: string;
}

export interface ExternalDragEnvelope<T> {
  [key: string]: unknown;
  kind: "vue-ui-dnd-external";
  type: string;
  payload: T;
}

export interface DragSourceOptions<T> {
  element: MaybeRefOrGetter<HTMLElement | null>;
  type: string;
  data: MaybeRefOrGetter<T>;
  disabled?: MaybeRefOrGetter<boolean>;
}

export interface DropEvent<T> {
  type: string;
  data: T;
  clientX: number;
  clientY: number;
}

export interface DropTargetOptions<T> {
  element: MaybeRefOrGetter<HTMLElement | null>;
  accept: string | readonly string[];
  disabled?: MaybeRefOrGetter<boolean>;
  onDrop: (event: DropEvent<T>) => void;
}
