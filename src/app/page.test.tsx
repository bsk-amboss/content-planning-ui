import { light, ThemeProvider } from '@amboss/design-system';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from './page';

describe('Home', () => {
  it('renders without throwing', () => {
    const { container } = render(
      <ThemeProvider theme={light}>
        <Home />
      </ThemeProvider>,
    );
    expect(container.textContent).toContain('amboss-content-planner-ui');
  });
});
