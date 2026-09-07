import {
  SortableList,
  useDragSource,
  useDropTarget,
} from "@simone-bianco/vue-ui-dnd";
import type {
  DragSourceOptions,
  DropEvent,
  DropTargetOptions,
  SortableListProps,
  SortableReorderEvent,
} from "@simone-bianco/vue-ui-dnd";

interface Instruction {
  id: number;
  title: string;
}

const props: SortableListProps<Instruction> = {
  itemKey: "id",
  orientation: "vertical",
  getItemLabel: (item) => item.title,
};

const event: SortableReorderEvent<Instruction> = {
  item: { id: 1, title: "Tools" },
  key: 1,
  fromIndex: 0,
  toIndex: 1,
  items: [],
  method: "keyboard",
};

const element = null as HTMLElement | null;
const dragOptions: DragSourceOptions<{ kind: string }> = {
  element,
  type: "example",
  data: { kind: "example" },
};
const dropOptions: DropTargetOptions<{ kind: string }> = {
  element,
  accept: "example",
  onDrop: (drop: DropEvent<{ kind: string }>) => void drop.data.kind,
};

void SortableList;
void useDragSource;
void useDropTarget;
void props;
void event;
void dragOptions;
void dropOptions;
