import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from './page';

describe('Home', () => {
  it('presents a clear introduction and an honest availability status', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Good things come in short links.',
      }),
    ).toBeVisible();
    expect(screen.getByText('Coming soon')).toBeVisible();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });
});
