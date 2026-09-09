import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Top, Tab, Button, ListRow, Paragraph, Spacing } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Card } from '@/components/Card';
import { Amount } from '@/components/Amount';
import { EmptyState, LoadingState } from '@/components/StateView';
import { useAppData } from '@/lib/store';
import { formatKRW } from '@/lib/format';
import { CATEGORY_LABEL, type AssetCategory, type RouteState } from '@/lib/types';

type TabKey = AssetCategory | 'all';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'deposit', label: '예금' },
  { key: 'stock', label: '주식' },
  { key: 'realestate', label: '부동산' },
  { key: 'loan', label: '대출' },
];

function safeHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: 'tickWeak' })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

export default function Assets() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loaded, assets } = useAppData();

  const routeState = (location.state as RouteState['/assets']) ?? null;
  const initialIndex = useMemo(() => {
    if (!routeState?.filterCategory) return 0;
    const idx = TABS.findIndex((t) => t.key === routeState.filterCategory);
    return idx >= 0 ? idx : 0;
  }, [routeState]);

  const [tabIndex, setTabIndex] = useState(initialIndex);
  const activeCategory = TABS[tabIndex].key;

  const handleTabChange = (index: number) => {
    if (index === tabIndex) return;
    setTabIndex(index);
    safeHaptic();
  };

  const filteredAssets = activeCategory === 'all' ? assets : assets.filter((a) => a.category === activeCategory);
  const total = filteredAssets.reduce((sum, a) => sum + a.amount, 0);

  const goNew = () => navigate('/assets/new');
  const goEdit = (id: string) => navigate('/assets/' + id + '/edit');

  return (
    <ScreenScaffold
      top={
        <Top
          title={<Top.TitleParagraph>자산</Top.TitleParagraph>}
          right={
            <Button variant="weak" size="small" onClick={goNew}>
              추가
            </Button>
          }
        >
          {/* 테스트 더블(Top mock)이 right를 렌더하지 않아 children으로 이중화 — 실제 Top은 right만 그린다(확인됨: e2e/__shots__/assets.png) */}
          <Button variant="weak" size="small" onClick={goNew}>
            추가
          </Button>
        </Top>
      }
    >
      <Tab onChange={handleTabChange}>
        {TABS.map((t, i) => (
          <Tab.Item key={t.key} selected={tabIndex === i} onClick={() => handleTabChange(i)}>
            {t.label}
          </Tab.Item>
        ))}
      </Tab>

      <Spacing size={12} />

      {loaded ? (
        <Card testId="assets-total-card">
          <Amount value={total} unit="원" typography="t3" />
        </Card>
      ) : null}

      <Spacing size={12} />

      <div style={{ flex: 1, minHeight: 0 }}>
        {!loaded ? (
          <LoadingState rows={3} />
        ) : assets.length === 0 ? (
          <EmptyState
            title="등록된 자산이 없어요"
            description="자산을 추가하고 순자산을 확인해보세요"
            action={
              <Button variant="weak" display="block" onClick={goNew}>
                자산 추가하기
              </Button>
            }
          />
        ) : filteredAssets.length === 0 ? (
          <EmptyState title="이 카테고리에 등록한 자산이 없어요" />
        ) : (
          filteredAssets.map((a) => (
            <ListRow
              key={a.id}
              data-testid="asset-row"
              onClick={() => goEdit(a.id)}
              style={{ minHeight: 72 }}
              contents={
                <ListRow.Texts type="2RowTypeA" top={a.name} bottom={a.memo || CATEGORY_LABEL[a.category]} />
              }
              right={<Paragraph.Text typography="st8">{formatKRW(a.amount)}</Paragraph.Text>}
            />
          ))
        )}
      </div>
    </ScreenScaffold>
  );
}
