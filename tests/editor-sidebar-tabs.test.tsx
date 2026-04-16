import './setup/happy-dom';
import './setup/react';

import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, mock } from 'bun:test';
import { cleanup } from '@testing-library/react';
import { EditorSidebarTabs } from '@/components/editor/EditorSidebarTabs';

afterEach(() => {
  cleanup();
});

describe('EditorSidebarTabs', () => {
  it('renders as a single-select toggle group and emits changes', () => {
    const onChange = mock((_: 'inspect' | 'animation') => {});

    const view = render(
      <EditorSidebarTabs
        ariaLabel="Right sidebar"
        value="inspect"
        onChange={onChange}
        options={[
          { value: 'inspect', label: 'Inspect' },
          { value: 'animation', label: 'Animation' },
        ]}
      />,
    );

    const inspect = view.getByRole('radio', { name: 'Inspect' });
    const animation = view.getByRole('radio', { name: 'Animation' });

    expect(inspect).toHaveAttribute('data-state', 'on');
    expect(animation).toHaveAttribute('data-state', 'off');

    fireEvent.click(animation);
    expect(onChange).toHaveBeenCalledWith('animation');
  });

  it('ignores empty-value deselection events from radix', () => {
    const onChange = mock((_: 'inspect' | 'animation') => {});

    const view = render(
      <EditorSidebarTabs
        ariaLabel="Right sidebar"
        value="inspect"
        onChange={onChange}
        options={[
          { value: 'inspect', label: 'Inspect' },
          { value: 'animation', label: 'Animation' },
        ]}
      />,
    );

    fireEvent.click(view.getByRole('radio', { name: 'Inspect' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
