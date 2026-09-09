import { Top, Button, Paragraph, Spacing, ListRow, Skeleton, Asset } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SummaryHero } from '../components/SummaryHero';
import { Card } from '../components/Card';
import { CountUp } from '../components/CountUp';
import { Sparkline } from '../components/Sparkline';
import { MiniBar } from '../components/MiniBar';
import { EmptyState } from '../components/StateView';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { useAppData } from '@/lib/store';
import { ASSET_CATEGORIES, CATEGORY_LABEL } from '@/lib/types';
import type { AssetCategory } from '@/lib/types';
import { formatSignedKRW, formatPercentage } from '@/lib/format';

function safeHaptic() {
  try {
    generateHapticFeedback({ type: 'tickWeak' });
  } catch {
    /* WebView 밖 — 무시 */
  }
}

/** 전월 대비 증감을 "+20,000,000원 (+11.1%)" 형식으로 포맷 */
function formatMomDelta(momDelta: number, netWorth: number): string {
  const prevNetWorth = netWorth - momDelta;
  const pct = prevNetWorth !== 0 ? (momDelta / Math.abs(prevNetWorth)) * 100 : 0;
  return `${formatSignedKRW(momDelta)} (${formatPercentage(pct, { showSign: true })})`;
}

const TAB_ITEMS = [
  { label: '홈', path: '/' },
  { label: '자산', path: '/assets' },
  { label: '추이', path: '/trend' },
  { label: '리포트', path: '/report' },
];

export default function Home() {
  const navigate = useNavigate();
  const { loaded, assets, summary, snapshots } = useAppData();

  const goBadges = () => {
    safeHaptic();
    navigate('/badges');
  };

  const goAssets = (filterCategory: AssetCategory) => {
    safeHaptic();
    navigate('/assets', { state: { filterCategory } });
  };

  const top = (
    <Top
      title={<Top.TitleParagraph>순자산</Top.TitleParagraph>}
      right={
        <Button variant="weak" size="small" onClick={goBadges}>
          뱃지
        </Button>
      }
    />
  );

  if (!loaded) {
    return (
      <ScreenScaffold top={top}>
        <div data-testid="hero-skeleton" style={{ height: 96 }}>
          <Skeleton />
        </div>
        <Spacing size={16} />
        <Card>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} data-testid="category-skeleton" style={{ height: 56 }}>
              <Skeleton />
            </div>
          ))}
        </Card>
        <FloatingTabBar items={TAB_ITEMS} />
      </ScreenScaffold>
    );
  }

  if (assets.length === 0) {
    return (
      <ScreenScaffold top={top}>
        <EmptyState
          icon={<Asset.ContentIcon name="il_notFound" alt="" />}
          title="아직 순자산 기록이 없어요"
          description="첫 자산을 등록하고 순자산을 확인해보세요"
          action={
            <Button variant="fill" display="block" onClick={() => navigate('/assets/new')}>
              자산 추가하기
            </Button>
          }
        />
        <FloatingTabBar items={TAB_ITEMS} />
      </ScreenScaffold>
    );
  }

  const netWorth = summary?.netWorth ?? 0;
  const momDelta = summary?.momDelta ?? null;
  const last6 = snapshots.slice(-6).map((s) => s.netWorth);

  return (
    <ScreenScaffold top={top}>
      <SummaryHero
        testId="networth-hero"
        label="현재 순자산"
        value={<CountUp value={netWorth} unit="원" typography="t2" />}
        caption={momDelta !== null ? formatMomDelta(momDelta, netWorth) : undefined}
      />

      {last6.length >= 2 ? <Sparkline data={last6} /> : null}

      <Spacing size={16} />

      <Card testId="category-card">
        <Paragraph.Text typography="t4">카테고리 비중</Paragraph.Text>
        <Spacing size={12} />
        {ASSET_CATEGORIES.map((category) => (
          <ListRow
            key={category}
            data-testid={`category-row-${category}`}
            onClick={() => goAssets(category)}
            contents={
              <ListRow.Texts
                type="2RowTypeA"
                top={CATEGORY_LABEL[category]}
                bottom={`${summary?.categoryRatio[category] ?? 0}%`}
              />
            }
            right={<MiniBar ratio={(summary?.categoryRatio[category] ?? 0) / 100} />}
          />
        ))}
      </Card>

      <Spacing size={24} />

      <FloatingTabBar items={TAB_ITEMS} />
    </ScreenScaffold>
  );
}
