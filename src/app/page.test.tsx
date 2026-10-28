import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from './page';

describe('Home', () => {
  it('introduces the app and provides a labelled shortening form', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Good things come in short links.',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('textbox', { name: 'Your long link' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Shorten link' })).toBeEnabled();
    expect(screen.getByRole('link', { name: /How it works/ })).toHaveAttribute(
      'href',
      '#how-it-works',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });
});
