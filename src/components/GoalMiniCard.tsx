import { Paragraph } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { Card } from './Card';
import { useAppData } from '@/lib/store';

function safeHaptic() {
  try {
    generateHapticFeedback({ type: 'tickWeak' });
  } catch {
    /* WebView 밖 — 무시 */
  }
}

/** 목표 유무에 따라 달성률 또는 '목표 설정하기'를 보여주는 홈 미니 카드 — 탭하면 목표 화면으로 이동. */
export function GoalMiniCard() {
  const { goal, summary } = useAppData();
  const navigate = useNavigate();

  const goGoal = () => {
    safeHaptic();
    navigate('/goal');
  };

  const label = goal
    ? `달성률 ${(((summary?.netWorth ?? 0) / goal.targetAmount) * 100).toFixed(1)}%`
    : '목표 설정하기';

  return (
    <Card testId="goal-mini-card" style={{ minHeight: 72, cursor: 'pointer' }} onClick={goGoal}>
      <Paragraph.Text typography="st8">{label}</Paragraph.Text>
    </Card>
  );
}
