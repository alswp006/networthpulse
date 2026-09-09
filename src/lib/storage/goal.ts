import type { Goal, Result } from '@/lib/types';
import { AMOUNT_MAX, AMOUNT_MIN, ERROR_MESSAGES, STORAGE_KEYS } from '@/lib/types';
import { nowISO, safeRead, safeWrite } from '@/lib/storage/core';

const KEY = STORAGE_KEYS.goal;

// 위치(index)가 아닌 문구로 찾는다 — ERROR_MESSAGES 배열 순서가 바뀌어도 안전
function findMessage(text: string): string {
  return ERROR_MESSAGES.find((msg) => msg === text)!;
}

const TARGET_AMOUNT_MIN_ERROR = findMessage('목표 금액을 1원 이상 입력해주세요');
const TARGET_AMOUNT_MAX_ERROR = findMessage('목표 금액은 999,999,999,999원까지 입력할 수 있어요');
const TARGET_DATE_ERROR = findMessage('목표 날짜는 오늘 이후로 정해주세요');

export interface GoalProgress {
  percent: number; // 0 이상, 소수 1자리 (상한 없음, 100 초과 가능)
  remaining: number; // 목표까지 남은 금액 (0 미만으로 내려가지 않음)
  monthsLeft: number; // 목표일까지 남은 개월 수 (0 미만으로 내려가지 않음)
  monthlyNeeded: number; // 월 필요 저축액
  achieved: boolean;
  surplus: number; // 목표 초과 달성액 (achieved일 때만 0 초과)
}

export interface GoalInput {
  targetAmount: number;
  targetDate: string; // 'YYYY-MM-DD'
}

export function getGoal(): Goal | null {
  return safeRead<Goal | null>(KEY, null);
}

export function saveGoal(input: GoalInput): Result<Goal> {
  if (input.targetAmount < AMOUNT_MIN) return { ok: false, error: TARGET_AMOUNT_MIN_ERROR };
  if (input.targetAmount > AMOUNT_MAX) return { ok: false, error: TARGET_AMOUNT_MAX_ERROR };

  const today = nowISO().slice(0, 10);
  if (input.targetDate <= today) return { ok: false, error: TARGET_DATE_ERROR };

  const existing = getGoal();
  const now = nowISO();
  const goal: Goal = {
    targetAmount: input.targetAmount,
    targetDate: input.targetDate,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const writeResult = safeWrite(KEY, goal);
  if (!writeResult.ok) return { ok: false, error: writeResult.error };

  return { ok: true, data: goal };
}

export function clearGoal(): void {
  safeWrite<Goal | null>(KEY, null);
}

function monthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

/** 저장된 Goal 기준 진행률 계산. Goal이 없으면 모두 0인 기본값 반환 */
export function computeGoalProgress(netWorth: number, today: Date = new Date()): GoalProgress {
  const goal = getGoal();
  if (!goal) {
    return { percent: 0, remaining: 0, monthsLeft: 0, monthlyNeeded: 0, achieved: false, surplus: 0 };
  }

  const rawPercent = (netWorth / goal.targetAmount) * 100;
  const percent = Math.round(Math.max(0, rawPercent) * 10) / 10;
  const achieved = netWorth >= goal.targetAmount;
  const remaining = Math.max(0, goal.targetAmount - netWorth);
  const surplus = achieved ? netWorth - goal.targetAmount : 0;

  const targetDate = new Date(`${goal.targetDate}T00:00:00`);
  const monthsLeft = monthsBetween(today, targetDate);
  const monthlyNeeded = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;

  return { percent, remaining, monthsLeft, monthlyNeeded, achieved, surplus };
}
