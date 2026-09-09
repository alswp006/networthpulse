import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Toast } from "@toss/tds-mobile";

/**
 * 저장/수정/삭제 성공 Toast 문구를 한 곳에서 관리 — 화면마다 문구를 흩어놓지 않는다.
 */
export const TOAST_MESSAGES = {
  saved: "저장했어요",
  updated: "수정했어요",
  deleted: "삭제했어요",
} as const;

export type ToastKind = keyof typeof TOAST_MESSAGES;

function isToastKind(value: unknown): value is ToastKind {
  return value === "saved" || value === "updated" || value === "deleted";
}

/**
 * location.state.toast 값을 읽어 1회 Toast로 보여주고 즉시 state를 비운다.
 * 라우트별 RouteState 계약에는 없는 횡단 관심사(저장/수정/삭제 알림)라 location.state를
 * 느슨하게 읽는다 — 값이 없거나 유효하지 않으면 아무것도 렌더하지 않는다.
 */
export function ToastHost() {
  const location = useLocation();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const state = location.state as { toast?: unknown } | null;
    const toastValue = state?.toast;
    if (!isToastKind(toastValue)) return;

    setMessage(TOAST_MESSAGES[toastValue]);
    navigate(location.pathname, { replace: true, state: null });
    // location만 의존 — 같은 state 참조로 재렌더되면 재실행되지 않는다(navigate 이후엔 state가
    // null로 바뀌어 isToastKind가 false를 반환하므로 자연히 1회로 그친다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return (
    <Toast
      open={!!message}
      position="bottom"
      text={message ?? ""}
      onClose={() => setMessage(null)}
    />
  );
}
