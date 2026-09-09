import { Paragraph, ListRow, Asset, Spacing } from '@toss/tds-mobile';
import { Card } from './Card';
import { MiniBar } from './MiniBar';
import { Amount } from './Amount';
import { AdSlot } from './AdSlot';
import type { NetWorthSummary, DiagnosisItem } from '@/lib/types';
import { ASSET_CATEGORIES, CATEGORY_LABEL } from '@/lib/types';

const TONE_COLOR: Record<DiagnosisItem['tone'], string> = {
  warn: 'var(--adaptiveRed500)',
  good: 'var(--adaptiveGreen500)',
  info: 'var(--adaptiveGrey700)',
};

const TONE_ICON: Record<DiagnosisItem['tone'], string> = {
  warn: 'iconWarningFilled',
  good: 'iconCheckFilled',
  info: 'iconInfoFilled',
};

interface ReportBodyProps {
  summary: NetWorthSummary;
  diagnosis: DiagnosisItem[];
}

/**
 * 리포트 본문 — 자산배분 Card · 부채비율 Card · 진단 Card · 배너 AdSlot.
 * summary/diagnosis는 계산 레이어(computeSummary/diagnose) 결과를 그대로 표시만 한다.
 */
export function ReportBody({ summary, diagnosis }: ReportBodyProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Card testId="allocation-card">
        <Paragraph.Text typography="t4">자산 배분</Paragraph.Text>
        <Spacing size={12} />
        {ASSET_CATEGORIES.map((category) => (
          <ListRow
            key={category}
            contents={
              <ListRow.Texts
                type="2RowTypeA"
                top={CATEGORY_LABEL[category]}
                bottom={
                  <span data-testid={`allocation-percent-${category}`}>
                    {summary.categoryRatio[category]}%
                  </span>
                }
              />
            }
            right={<MiniBar ratio={summary.categoryRatio[category] / 100} />}
          />
        ))}
      </Card>
      <Spacing size={16} />
      <Card testId="debt-card">
        <Paragraph.Text typography="st8">부채비율</Paragraph.Text>
        <Amount value={summary.debtRatio} unit="%" typography="t3" testId="debt-ratio" />
      </Card>
      <Spacing size={16} />
      <Card testId="diagnosis-card">
        {diagnosis.map((item) => (
          <div
            key={item.id}
            data-testid={`diagnosis-item-${item.id}`}
            data-tone={item.tone}
            style={{ color: TONE_COLOR[item.tone] }}
          >
            <ListRow
              left={<Asset.ContentIcon name={TONE_ICON[item.tone]} alt={item.tone} />}
              contents={
                <ListRow.Texts type="2RowTypeA" top={item.title} bottom={item.description} />
              }
            />
          </div>
        ))}
      </Card>
      <Spacing size={16} />
      <AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />
    </div>
  );
}
