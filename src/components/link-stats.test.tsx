import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LinkStatsView } from './link-stats';

const stats = {
  code: 'Ab12_cd3',
  createdAt: new Date('2026-10-30T00:00:00Z'),
  totalClicks: BigInt(0),
  days: Array.from({ length: 7 }, (_, index) => ({
    day: `2026-10-${24 + index}`,
    clicks: BigInt(0),
  })),
};

describe('LinkStatsView', () => {
  it('shows an honest empty state and accessible daily counts', () => {
    render(<LinkStatsView stats={stats} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Your link, in numbers.',
    );
    expect(screen.getByText(/No redirects recorded/)).toBeVisible();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(
      8,
    );
    expect(screen.getByText(/Anyone with this short code/)).toBeVisible();
    expect(
      screen.getByRole('link', { name: /Open short link/ }),
    ).toHaveAttribute('href', '/Ab12_cd3');
    expect(screen.getByText(/aren’t unique visitors/)).toBeVisible();
  });
  it('formats counts beyond JavaScript’s safe integer range exactly', () => {
    const large = BigInt('9007199254740993');
    render(
      <LinkStatsView
        stats={{
          ...stats,
          totalClicks: large,
          days: stats.days.map((day, index) => ({
            ...day,
            clicks: index === 6 ? large : BigInt(0),
          })),
        }}
      />,
    );
    expect(screen.getAllByText('9,007,199,254,740,993')).toHaveLength(4);
    expect(screen.queryByText(/No redirects recorded/)).not.toBeInTheDocument();
  });
});
