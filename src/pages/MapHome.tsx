import { useState } from 'react';
import { FloatButton, Tooltip } from 'antd';
import { PlusOutlined, PushpinOutlined } from '@ant-design/icons';
import MapCanvas from '@/components/map/MapCanvas';
import PolicyList from '@/components/sidebar/PolicyList';
import StatsPanel from '@/components/panels/StatsPanel';
import TopRankPanel from '@/components/panels/TopRankPanel';
import VisitDialog from '@/components/dialogs/VisitDialog';
import PinDialog from '@/components/dialogs/PinDialog';
import PinBoard from '@/components/dialogs/PinBoard';
import { useMapStore } from '@/stores/mapStore';
import { useAuthStore } from '@/stores/authStore';
import type { Pin, VisitRecord } from '@/types';

export default function MapHome() {
  const mode = useMapStore((s) => s.mode);
  const user = useAuthStore((s) => s.user);
  const [visitOpen, setVisitOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<VisitRecord | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinBoardOpen, setPinBoardOpen] = useState(false);
  const [activePin, setActivePin] = useState<Pin | null>(null);

  const canCreatePin = user && (user.role === 'pmo' || user.role === 'lead');
  const canCreateVisit = user && ['ga', 'pmo', 'lead'].includes(user.role);

  const handleVisitClick = (v: VisitRecord) => {
    setEditingVisit(v);
    setVisitOpen(true);
  };

  const handlePinClick = (p: Pin) => {
    setActivePin(p);
    setPinBoardOpen(true);
  };

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative' }}>
      {mode === 'policy' && <PolicyList />}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <MapCanvas onVisitClick={handleVisitClick} onPinClick={handlePinClick} />

        <StatsPanel />
        <TopRankPanel />

        <div className="fab-slot">
          {canCreatePin && (
            <Tooltip title="新建图钉（PMO/负责人）" placement="left">
              <FloatButton
                icon={<PushpinOutlined />}
                type="default"
                onClick={() => setPinOpen(true)}
                style={{ insetInlineEnd: 'auto', right: 0 }}
              />
            </Tooltip>
          )}
          {canCreateVisit && (
            <Tooltip title="新增拜访记录" placement="left">
              <FloatButton
                icon={<PlusOutlined />}
                type="primary"
                onClick={() => {
                  setEditingVisit(null);
                  setVisitOpen(true);
                }}
                style={{ insetInlineEnd: 'auto', right: 0 }}
              />
            </Tooltip>
          )}
        </div>
      </div>

      <VisitDialog
        open={visitOpen}
        editing={editingVisit}
        onClose={() => {
          setVisitOpen(false);
          setEditingVisit(null);
        }}
      />
      <PinDialog open={pinOpen} onClose={() => setPinOpen(false)} />
      <PinBoard
        open={pinBoardOpen}
        pin={activePin}
        onClose={() => {
          setPinBoardOpen(false);
          setActivePin(null);
        }}
      />
    </div>
  );
}
