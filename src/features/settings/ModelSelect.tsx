import { ChevronDown } from "lucide-react";
import { useSettingsStore } from "@/stores/settings-store";

export function ModelSelect() {
  const model = useSettingsStore((state) => state.model);
  const models = useSettingsStore((state) => state.models);
  const setModel = useSettingsStore((state) => state.setModel);
  const options = models.includes(model) ? models : [model, ...models];

  return (
    <label className="relative inline-flex h-8 items-center">
      <select
        value={model}
        onChange={(event) => setModel(event.target.value)}
        data-tauri-drag-region="false"
        className="h-8 appearance-none rounded-lg border border-border bg-elevated py-0 pl-2.5 pr-7 text-[12px] text-fg outline-none"
      >
        {options.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3 text-subtle" />
    </label>
  );
}
