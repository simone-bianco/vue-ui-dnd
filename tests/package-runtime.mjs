import { createSSRApp, h, ref } from "vue";
import { renderToString } from "@vue/server-renderer";
import { SortableList } from "@simone-bianco/vue-ui-dnd";

const items = ref([
  { id: 1, title: "Tools" },
  { id: 2, title: "Packages" },
]);

const app = createSSRApp({
  setup() {
    return () =>
      h(
        SortableList,
        {
          modelValue: items.value,
          "onUpdate:modelValue": (value) => {
            items.value = value;
          },
          itemKey: "id",
          getItemLabel: (item) => item.title,
        },
        {
          item: ({ item }) => h("span", item.title),
        },
      );
  },
});

const html = await renderToString(app);
if (!html.includes("Tools") || !html.includes("Packages")) {
  throw new Error("SortableList SSR smoke render did not include expected item content.");
}

console.log("ESM import + SSR smoke passed");