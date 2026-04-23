import { Segmented } from 'antd';
import { useMapStore } from '@/stores/mapStore';
import type { MapMode } from '@/types';

export default function ModeSwitch() {
  const mode = useMapStore((s) => s.mode);
  const setMode = useMapStore((s) => s.setMode);
  return (
    <Segmented<MapMode>
      value={mode}
      onChange={(v) => setMode(v)}
      options={[
        { label: '属地大盘', value: 'region' },
        { label: '政策大盘', value: 'policy' },
      ]}
    />
  );
}
