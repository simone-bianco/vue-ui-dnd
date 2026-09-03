import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SortableList from "../src/components/SortableList.vue";

const mocks = vi.hoisted(() => ({
  draggables: [] as any[],
  dropTargets: [] as any[],
  monitors: [] as any[],
  cleanups: [] as ReturnType<typeof vi.fn>[],
}));

vi.mock("@atlaskit/pragmatic-drag-and-drop/element/adapter", () => ({
  draggable: (config: any) => {
    mocks.draggables.push(config);
    const cleanup = vi.fn();
    mocks.cleanups.push(cleanup);
    return cleanup;
  },
  dropTargetForElements: (config: any) => {
    mocks.dropTargets.push(config);
    const cleanup = vi.fn();
    mocks.cleanups.push(cleanup);
    return cleanup;
  },
  monitorForElements: (config: any) => {
    mocks.monitors.push(config);
    const cleanup = vi.fn();
    mocks.cleanups.push(cleanup);
    return cleanup;
  },
}));

vi.mock("@atlaskit/pragmatic-drag-and-drop/combine", () => ({
  combine:
    (...cleanups: Array<() => void>) =>
    () =>
      cleanups.forEach((cleanup) => cleanup()),
}));

interface Item {
  id: number;
  title: string;
}

const initialItems = (): Item[] => [
  { id: 1, title: "Tools" },
  { id: 2, title: "Packages" },
  { id: 3, title: "Behaviour" },
];

async function mountList(options: {
  useHandle?: boolean;
  disabled?: boolean;
  canDrag?: (item: Item, index: number) => boolean;
} = {}) {
  let model = initialItems();
  const wrapper = mount(SortableList<Item>, {
    props: {
      modelValue: model,
      itemKey: "id",
      getItemLabel: (item: Item) => item.title,
      useHandle: options.useHandle,
      disabled: options.disabled,
      canDrag: options.canDrag,
      "onUpdate:modelValue": (value: Item[]) => {
        model = value;
        void wrapper.setProps({ modelValue: value });
      },
    },
    slots: {
      item: ({ item }: { item: Item }) => item.title,
    },
  });

  await nextTick();
  await nextTick();
  return { wrapper, getModel: () => model };
}

function dragData(config: any) {
  return config.getInitialData();
}

function targetData(config: any) {
  return config.getData();
}

describe("SortableList", () => {
  beforeEach(() => {
    mocks.draggables.length = 0;
    mocks.dropTargets.length = 0;
    mocks.monitors.length = 0;
    mocks.cleanups.length = 0;
  });

  it("reorders on pointer drop after source callbacks and emits the resulting model", async () => {
    const { wrapper, getModel } = await mountList();
    expect(mocks.draggables).toHaveLength(3);
    expect(mocks.dropTargets).toHaveLength(3);
    expect(mocks.monitors).toHaveLength(1);

    const source = mocks.draggables[0];
    const target = mocks.dropTargets[1];
    const sourceData = dragData(source);
    const selfData = targetData(target);

    const targetElement = wrapper.get('[data-sortable-key="number:2"]').element as HTMLElement;
    vi.spyOn(targetElement, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      toJSON: () => ({}),
    });

    source.onDragStart?.({ source: { data: sourceData } });
    target.onDrag?.({
      source: { data: sourceData },
      self: { data: selfData },
      location: { current: { input: { clientX: 10, clientY: 90 } } },
    });

    // PDD 3.1.0 dispatches source onDrop before monitor onDrop. This call is
    // intentionally present so the regression test fails if source cleanup
    // destroys target state before the monitor can compute the reorder.
    source.onDrop?.({ source: { data: sourceData } });
    mocks.monitors[0].onDrop?.({
      source: { data: sourceData },
      location: { current: { dropTargets: [{ data: selfData }] } },
    });
    await nextTick();

    expect(getModel().map((item) => item.id)).toEqual([2, 1, 3]);
    const events = wrapper.emitted("reorder");
    expect(events).toHaveLength(1);
    expect(events?.[0]?.[0]).toMatchObject({
      key: 1,
      fromIndex: 0,
      toIndex: 1,
      method: "pointer",
    });
  });

  it("does not reorder on an outside drop and clears transient drop state", async () => {
    const { wrapper, getModel } = await mountList();
    const source = mocks.draggables[0];
    const target = mocks.dropTargets[1];
    const sourceData = dragData(source);
    const selfData = targetData(target);

    const targetElement = wrapper.get('[data-sortable-key="number:2"]').element as HTMLElement;
    vi.spyOn(targetElement, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      toJSON: () => ({}),
    });

    target.onDrag?.({
      source: { data: sourceData },
      self: { data: selfData },
      location: { current: { input: { clientX: 10, clientY: 10 } } },
    });
    await nextTick();
    expect(wrapper.get('[data-sortable-key="number:2"]').attributes("data-drop-position")).toBe("before");

    mocks.monitors[0].onDrop?.({
      source: { data: sourceData },
      location: { current: { dropTargets: [] } },
    });
    await nextTick();

    expect(getModel().map((item) => item.id)).toEqual([1, 2, 3]);
    expect(wrapper.emitted("reorder")).toBeUndefined();
    expect(wrapper.get('[data-sortable-key="number:2"]').attributes("data-drop-position")).toBeUndefined();
  });

  it("supports keyboard reorder from the handle", async () => {
    const { wrapper, getModel } = await mountList();
    const handles = wrapper.findAll("button.vue-ui-sortable-list__handle");

    await handles[0].trigger("keydown", { key: "ArrowDown" });
    await nextTick();

    expect(getModel().map((item) => item.id)).toEqual([2, 1, 3]);
    expect(wrapper.emitted("reorder")?.[0]?.[0]).toMatchObject({ method: "keyboard", fromIndex: 0, toIndex: 1 });
  });

  it("preserves keyboard reorder when whole-item dragging is enabled", async () => {
    const { wrapper, getModel } = await mountList({ useHandle: false });
    const first = wrapper.get('[data-sortable-key="number:1"]');

    expect(first.attributes("tabindex")).toBe("0");
    expect(first.attributes("aria-label")).toBe("Reorder Tools");
    await first.trigger("keydown", { key: "End" });
    await nextTick();

    expect(getModel().map((item) => item.id)).toEqual([2, 3, 1]);
    expect(wrapper.emitted("reorder")?.[0]?.[0]).toMatchObject({ method: "keyboard", fromIndex: 0, toIndex: 2 });
  });

  it("honors disabled and per-item canDrag guards", async () => {
    const disabled = await mountList({ disabled: true });
    const disabledHandle = disabled.wrapper.find("button.vue-ui-sortable-list__handle");
    expect(disabledHandle.attributes("disabled")).toBeDefined();
    await disabledHandle.trigger("keydown", { key: "ArrowDown" });
    expect(disabled.getModel().map((item) => item.id)).toEqual([1, 2, 3]);
    disabled.wrapper.unmount();

    const guarded = await mountList({ canDrag: (item) => item.id !== 1 });
    const guardedHandle = guarded.wrapper.find("button.vue-ui-sortable-list__handle");
    expect(guardedHandle.attributes("disabled")).toBeDefined();
    await guardedHandle.trigger("keydown", { key: "ArrowDown" });
    expect(guarded.getModel().map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it("cleans up draggable, target, and monitor registrations on unmount", async () => {
    const { wrapper } = await mountList();
    const cleanups = [...mocks.cleanups];

    wrapper.unmount();

    expect(cleanups).not.toHaveLength(0);
    expect(cleanups.every((cleanup) => cleanup.mock.calls.length > 0)).toBe(true);
  });
});