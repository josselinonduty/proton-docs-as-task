import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, withDefaults } from './defaults';
import {
  DEFAULT_LAYOUT,
  LAYOUTS,
  LAYOUT_PRESETS,
  layoutForView,
  onboardingPatch,
} from './onboarding';

describe('onboardingPatch', () => {
  it('leaves the default settings untouched for the default choices', () => {
    const next = withDefaults({
      ...DEFAULT_SETTINGS,
      ...onboardingPatch(DEFAULT_LAYOUT, 'standard'),
    });
    expect(next).toEqual(DEFAULT_SETTINGS);
  });

  it('only touches layout and status flow settings', () => {
    for (const layout of LAYOUTS) {
      expect(Object.keys(onboardingPatch(layout, 'review')).sort()).toEqual([
        'cardFields',
        'defaultStatuses',
        'defaultView',
        'density',
      ]);
    }
  });

  it('keeps the list layout down to title and due date', () => {
    const { cardFields } = LAYOUT_PRESETS.list;
    expect(cardFields).toMatchObject({
      description: false,
      priority: false,
      assignee: false,
      labels: false,
      due: true,
    });
  });

  it('carries the chosen status flow and a view each layout can render', () => {
    expect(onboardingPatch('swimlanes', 'simple')).toMatchObject({
      defaultView: 'swimlane',
      defaultStatuses: 'simple',
    });
    expect(withDefaults(onboardingPatch('list', 'review')).defaultView).toBe('list');
  });

  it('hands out a copy of the card fields', () => {
    const patch = onboardingPatch('board', 'standard');
    patch.cardFields!.due = false;
    expect(LAYOUT_PRESETS.board.cardFields.due).toBe(true);
  });
});

describe('layoutForView', () => {
  it('maps each preset view back to its layout', () => {
    for (const layout of LAYOUTS) {
      expect(layoutForView(LAYOUT_PRESETS[layout].defaultView)).toBe(layout);
    }
  });

  it('falls back to the default layout for a view without a preset', () => {
    expect(layoutForView('sections')).toBe(DEFAULT_LAYOUT);
  });
});
