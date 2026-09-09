import { useState } from 'react';
import { BottomSheet, Button, Paragraph, Spacing } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { MILESTONES } from '@/lib/types';
import { useAppData } from '@/lib/store';

function safeHaptic() {
  try {
    generateHapticFeedback({ type: 'success' });
  } catch {
    /* WebView 밖 — 무시 */
  }
}

function milestoneLabel(id: string): string {
  return MILESTONES.find((m) => m.id === id)?.label ?? '목표';
}

/** 신규 뱃지 달성 시 1회 노출되는 축하 BottomSheet — 큐에 쌓인 순서대로 하나씩 보여준다. */
export function BadgeCelebrationSheet() {
  const { newBadges, consumeBadge } = useAppData();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const badge = newBadges.find((b) => !hiddenIds.has(b.id));

  const hideBadge = (id: string) => setHiddenIds((prev) => new Set(prev).add(id));

  const handleConfirm = () => {
    if (!badge) return;
    consumeBadge(badge.id);
    hideBadge(badge.id);
    safeHaptic();
  };

  const handleClose = () => {
    if (!badge) return;
    hideBadge(badge.id);
  };

  return (
    <BottomSheet open={!!badge} onClose={handleClose}>
      {badge && (
        <>
          <Paragraph.Text typography="t3">{milestoneLabel(badge.id)} 달성!</Paragraph.Text>
          <Spacing size={16} />
          <Button variant="fill" size="large" display="block" onClick={handleConfirm}>
            확인
          </Button>
        </>
      )}
    </BottomSheet>
  );
}
