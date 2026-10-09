import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { DealSnapshotPage } from './DealSnapshotPage';
vi.mock('@/components/layout/ShellChrome', () => ({ useDeepHeader: vi.fn() }));
vi.mock('@/domain/danContext', () => ({ useDan: () => ({
  currentUser: { id: 'peer' }, myMatches: [{ id: 'match', demandId: 'demand', productId: 'product', sellIntentId: 'sell', buyerId: 'peer', status: 'COMPLETED' }],
  state: { sellIntents: [{ id: 'sell', minimumPrice: 15000 }] },
  getDemand: () => ({ fulfillmentOptions: [] }), getProduct: () => ({ id: 'product', name: 'item' }),
  getDealEvidence: async () => null,
  getDealSnapshot: async () => ({ agreedPrice: 15000, lockedAt: '2026-10-06', snapshot: { accountDeleted: true } }),
  confirmDealSnapshot: vi.fn(),
}) }));
afterEach(cleanup);
it('shows terminal amount after personal evidence deletion without asking for new evidence', async () => {
  render(<MemoryRouter initialEntries={['/deal/match/snapshot']}><Routes><Route path="/deal/:matchId/snapshot" element={<DealSnapshotPage />} /></Routes></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: '종료된 거래 기록' })).toBeVisible();
  expect(screen.getByText('합의 금액: 15,000원')).toBeVisible();
  expect(screen.queryByRole('link', { name: '상품 정보 등록' })).not.toBeInTheDocument();
});
