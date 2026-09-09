import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertDialog, Button, ListRow, Paragraph, Toast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import type { Asset } from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/types";
import { useAppData } from "@/lib/store";
import { formatKRW } from "@/lib/format";
import { TOAST_MESSAGES } from "@/components/ToastHost";

/**
 * 자산 행 하나 — 본문 탭(수정 이동)과 삭제 버튼(확인 다이얼로그 + 삭제)을 분리해
 * 두 이벤트가 서로의 영역에 겹치지 않게 구성한다.
 */
export default function AssetRowActions({ asset }: { asset: Asset }) {
  const navigate = useNavigate();
  const { removeAsset } = useAppData();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);

  const goToEdit = () => navigate(`/assets/${asset.id}/edit`);

  const handleBodyKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goToEdit();
    }
  };

  const askDelete = (e: MouseEvent) => {
    e.stopPropagation();
    setConfirmOpen(true);
  };

  const confirmDelete = () => {
    removeAsset(asset.id);
    setConfirmOpen(false);
    try {
      generateHapticFeedback({ type: "success" });
    } catch {
      // WebView 밖(로컬/검수 PC)에서는 SDK가 throw한다 — 흰 화면 방지를 위해 조용히 무시
    }
    setToastOpen(true);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        data-testid="asset-row-body"
        role="button"
        tabIndex={0}
        onClick={goToEdit}
        onKeyDown={handleBodyKeyDown}
        style={{ flex: 1, minHeight: 44, display: "flex", alignItems: "center" }}
      >
        <ListRow.Texts type="2RowTypeA" top={asset.name} bottom={CATEGORY_LABEL[asset.category]} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Paragraph.Text typography="st8">{formatKRW(asset.amount)}</Paragraph.Text>
        <Button variant="weak" size="small" color="danger" onClick={askDelete}>
          삭제
        </Button>
      </div>

      <AlertDialog
        open={confirmOpen}
        title="삭제할까요?"
        description="삭제한 자산은 되돌릴 수 없어요"
        alertButton={<AlertDialog.AlertButton onClick={confirmDelete}>삭제</AlertDialog.AlertButton>}
        onClose={() => setConfirmOpen(false)}
      />

      <Toast
        open={toastOpen}
        position="bottom"
        text={TOAST_MESSAGES.deleted}
        onClose={() => setToastOpen(false)}
      />
    </div>
  );
}
