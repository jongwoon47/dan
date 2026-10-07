import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AccountDeletionPage } from './AccountDeletionPage';
const { status, deletion, finish } = vi.hoisted(() => ({ status: vi.fn(), deletion: vi.fn(), finish: vi.fn() }));
vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'self' }, mode: 'supabase', finishAccountDeletion: finish }) }));
vi.mock('@/components/layout/ShellChrome', () => ({ useDeepHeader: vi.fn() }));
vi.mock('@/auth/accountDeletion', () => ({ accountDeletionStatus: status, deleteAccount: deletion }));
beforeEach(() => { vi.resetAllMocks(); status.mockResolvedValue({ activeTransactions: 0, pending: false }); });
afterEach(cleanup);
const show = () => render(<MemoryRouter><AccountDeletionPage /></MemoryRouter>);
it('requires a separate final confirmation and ignores duplicate clicks', async () => {
  deletion.mockReturnValue(new Promise(() => {})); show();
  const button = screen.getByRole('button', { name: '계정 삭제' });
  await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
  expect(deletion).not.toHaveBeenCalled(); const final = screen.getByRole('button', { name: '계정 영구 삭제' });
  fireEvent.click(final); fireEvent.click(final); expect(deletion).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('status')).toHaveTextContent('삭제하고'); expect(finish).not.toHaveBeenCalled();
});
it('blocks active trades and offers the existing trade screen', async () => {
  status.mockResolvedValue({ activeTransactions: 2, pending: false }); show();
  await screen.findByText(/정리할 거래 또는 분쟁이 2건/);
  expect(screen.getByRole('button', { name: '계정 삭제' })).toBeDisabled();
  expect(screen.getByRole('link', { name: '내 거래 확인' })).toHaveAttribute('href', '/my');
});
it('does not delete on cancellation and allows retry after failure', async () => {
  deletion.mockRejectedValue(new Error('일시 오류')); show();
  const start = screen.getByRole('button', { name: '계정 삭제' }); await waitFor(() => expect(start).toBeEnabled());
  fireEvent.click(start); fireEvent.click(screen.getByRole('button', { name: '취소' }));
  expect(deletion).not.toHaveBeenCalled(); fireEvent.click(start); fireEvent.click(screen.getByRole('button', { name: '계정 영구 삭제' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('일시 오류'); expect(start).toBeEnabled(); expect(finish).not.toHaveBeenCalled();
});
it('clears auth only after confirmed server success', async () => {
  deletion.mockResolvedValue(undefined); show(); const start = screen.getByRole('button', { name: '계정 삭제' });
  await waitFor(() => expect(start).toBeEnabled()); fireEvent.click(start); fireEvent.click(screen.getByRole('button', { name: '계정 영구 삭제' }));
  await waitFor(() => expect(finish).toHaveBeenCalledTimes(1));
});
it('offers recovery if availability cannot be checked', async () => {
  status.mockRejectedValue(new Error('offline')); show(); await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: '계정 삭제' })).toBeDisabled();
  status.mockResolvedValue({ activeTransactions: 0, pending: true }); fireEvent.click(screen.getByRole('button', { name: '다시 확인' }));
  await screen.findByText('이전에 시작한 삭제를 이어서 완료해 주세요.');
});
