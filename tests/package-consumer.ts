import { SortableList } from "@simone-bianco/vue-ui-dnd";
import type { SortableListProps, SortableReorderEvent } from "@simone-bianco/vue-ui-dnd";

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

void SortableList;
void props;
void event;