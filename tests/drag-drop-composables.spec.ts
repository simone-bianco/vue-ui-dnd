import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDragSource } from "../src/composables/useDragSource";
import { useDropTarget } from "../src/composables/useDropTarget";

const mocks = vi.hoisted(() => ({
  draggables: [] as any[],
  dropTargets: [] as any[],
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
}));

const Harness = defineComponent({
  props: {
    disabled: { type: Boolean, default: false },
    swap: { type: Boolean, default: false },
  },
  setup(props) {
    const source = ref<HTMLElement | null>(null);
    const target = ref<HTMLElement | null>(null);
    const drops = ref<
      Array<{ type: string; kind: string; clientX: number; clientY: number }>
    >([]);

    useDragSource({
      element: source,
      type: "overseer-flow-node",
      data: { kind: "wait" },
      disabled: () => props.disabled,
    });
    useDropTarget<{ kind: string }>({
      element: target,
      accept: "overseer-flow-node",
      disabled: () => props.disabled,
      onDrop: (event) =>
        drops.value.push({
          type: event.type,
          kind: event.data.kind,
          clientX: event.clientX,
          clientY: event.clientY,
        }),
    });

    return { source, target, drops };
  },
  template: `
    <div>
      <button v-if="!swap" ref="source" data-source="a">Drag</button>
      <button v-else ref="source" data-source="b">Drag replacement</button>
      <div ref="target" data-target>Drop</div>
    </div>
  `,
});

describe("external drag/drop composables", () => {
  beforeEach(() => {
    mocks.draggables.length = 0;
    mocks.dropTargets.length = 0;
    mocks.cleanups.length = 0;
  });

  it("normalizes accepted element-local drops with client coordinates", async () => {
    const wrapper = mount(Harness);
    await nextTick();
    await nextTick();

    const source = mocks.draggables[mocks.draggables.length - 1];
    const target = mocks.dropTargets[mocks.dropTargets.length - 1];
    const data = source.getInitialData();

    expect(target.canDrop({ source: { data } })).toBe(true);
    expect(
      target.canDrop({
        source: {
          data: { ...data, type: "other" },
        },
      }),
    ).toBe(false);

    target.onDrop({
      source: { data },
      location: { current: { input: { clientX: 321, clientY: 654 } } },
    });

    expect((wrapper.vm as any).drops).toEqual([
      {
        type: "overseer-flow-node",
        kind: "wait",
        clientX: 321,
        clientY: 654,
      },
    ]);
  });

  it("cleans registrations on element ref change, disable, and unmount", async () => {
    const wrapper = mount(Harness);
    await nextTick();
    await nextTick();
    const initialCleanups = [...mocks.cleanups];

    await wrapper.setProps({ swap: true });
    await nextTick();
    await nextTick();
    expect(
      initialCleanups.some((cleanup) => cleanup.mock.calls.length > 0),
    ).toBe(true);

    const beforeDisable = [...mocks.cleanups];
    await wrapper.setProps({ disabled: true });
    await nextTick();
    expect(beforeDisable.some((cleanup) => cleanup.mock.calls.length > 0)).toBe(
      true,
    );

    const beforeUnmount = [...mocks.cleanups];
    wrapper.unmount();
    expect(
      beforeUnmount.every((cleanup) => cleanup.mock.calls.length > 0),
    ).toBe(true);
  });
});
