import { useState, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Chip, ChipItem, Paragraph, Spacing, TextField, Top } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SubmitFooter } from '@/components/BottomCTA';
import { useAppData } from '@/lib/store';
import { ASSET_CATEGORIES, CATEGORY_LABEL } from '@/lib/types';
import type { AssetCategory, RouteState } from '@/lib/types';

function fireTickWeak() {
  try {
    Promise.resolve(generateHapticFeedback({ type: 'tickWeak' })).catch(() => {});
  } catch {
    // WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시
  }
}

export default function AssetNew() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addAsset } = useAppData();

  const routeState = (location.state as RouteState['/assets/new']) ?? null;

  const [name, setName] = useState('');
  const [category, setCategory] = useState<AssetCategory>(routeState?.presetCategory ?? 'deposit');
  const [amountDigits, setAmountDigits] = useState('');
  const [memo, setMemo] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const displayAmount = amountDigits ? Number(amountDigits).toLocaleString('ko-KR') : '';

  function handleAmountChange(e: ChangeEvent<HTMLInputElement>) {
    setAmountDigits(e.target.value.replace(/[^0-9]/g, ''));
  }

  function handleSelectCategory(next: AssetCategory) {
    setCategory(next);
    fireTickWeak();
  }

  function handleSubmit() {
    setSubmitting(true);
    const result = addAsset({
      name,
      category,
      amount: amountDigits ? Number(amountDigits) : 0,
      memo,
    });
    setSubmitting(false);

    if (!result.ok) {
      setNameError(result.error);
      return;
    }

    setNameError(null);
    navigate('/assets', { state: { toast: 'saved' }, replace: true });
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>자산 추가</Top.TitleParagraph>} />}
      bottom={<SubmitFooter label="저장" onClick={handleSubmit} loading={submitting} />}
    >
      <TextField
        data-testid="asset-name-input"
        variant="line"
        label="이름"
        placeholder="국민은행 예금"
        maxLength={20}
        value={name}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        hasError={!!nameError}
        help={nameError ?? undefined}
      />
      <Spacing size={16} />
      <Paragraph.Text typography="st13">카테고리</Paragraph.Text>
      <Spacing size={8} />
      <Chip kind="select" wrap>
        {ASSET_CATEGORIES.map((c) => (
          <ChipItem key={c} selected={category === c} onClick={() => handleSelectCategory(c)}>
            {CATEGORY_LABEL[c]}
          </ChipItem>
        ))}
      </Chip>
      <Spacing size={16} />
      <TextField
        data-testid="asset-amount-input"
        variant="line"
        label="금액"
        placeholder="1,000,000"
        inputMode="numeric"
        enterKeyHint="done"
        suffix="원"
        value={displayAmount}
        onChange={handleAmountChange}
      />
      <Spacing size={16} />
      <TextField
        variant="line"
        label="메모(선택)"
        placeholder="예: 매달 자동이체"
        maxLength={50}
        value={memo}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setMemo(e.target.value)}
      />
    </ScreenScaffold>
  );
}
