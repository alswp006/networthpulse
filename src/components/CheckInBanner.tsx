import { useState } from 'react';
import { Button, Paragraph, Spacing } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { Card } from './Card';
import { useAppData } from '@/lib/store';

const STALE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(iso: string | null): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / DAY_MS;
}

function safeHaptic(type: 'success' | 'tickWeak') {
  try {
    generateHapticFeedback({ type });
  } catch {
    /* WebView 밖 — 무시 */
  }
}

/** 마지막 체크인이 7일 이상 지났을 때 노출되는 홈 배너 — 탭하면 자산 화면으로 이동. */
export function CheckInBanner() {
  const { meta, checkIn } = useAppData();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || daysSince(meta.lastCheckInAt) < STALE_DAYS) return null;

  const handleCheckIn = () => {
    checkIn();
    setDismissed(true);
    safeHaptic('success');
    navigate('/assets');
  };

  return (
    <Card testId="checkin-banner">
      <Paragraph.Text typography="st8">7일 동안 자산을 업데이트하지 않았어요</Paragraph.Text>
      <Spacing size={12} />
      <Button variant="fill" size="large" display="block" onClick={handleCheckIn}>
        지금 업데이트
      </Button>
    </Card>
  );
}
