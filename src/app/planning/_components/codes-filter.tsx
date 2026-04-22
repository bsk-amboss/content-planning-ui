'use client';

import { Button, Combobox, Inline, Select } from '@amboss/design-system';
import { COVERAGE_LEVELS } from '@/lib/repositories/types';

export interface CodeFilterState {
  source: string;
  category: string;
  consolidationCategory: string;
  coverage: string;
  inAmboss: string;
}

export interface CodeFilterOptions {
  sources: string[];
  categories: string[];
  consolidationCategories: string[];
}

const EMPTY = { value: '', label: 'All' };

type Key = keyof CodeFilterState;

export function CodesFilter({
  options,
  filters,
  onChange,
  onClear,
}: {
  options: CodeFilterOptions;
  filters: CodeFilterState;
  onChange: (key: Key, value: string) => void;
  onClear: () => void;
}) {
  const anyActive = Object.values(filters).some((v) => v);

  const asOptions = (vals: string[]) => [
    EMPTY,
    ...vals.map((v) => ({ value: v, label: v })),
  ];

  return (
    <Inline space="s" vAlignItems="bottom">
      <div className="filter-cell">
        <Combobox
          name="source"
          label="Source"
          placeholder="All"
          options={asOptions(options.sources)}
          value={filters.source}
          onChange={(e) => onChange('source', e.target.value)}
        />
      </div>
      <div className="filter-cell">
        <Combobox
          name="category"
          label="Category"
          placeholder="All"
          options={asOptions(options.categories)}
          value={filters.category}
          onChange={(e) => onChange('category', e.target.value)}
        />
      </div>
      <div className="filter-cell">
        <Combobox
          name="consolidationCategory"
          label="Consolidation"
          placeholder="All"
          options={asOptions(options.consolidationCategories)}
          value={filters.consolidationCategory}
          onChange={(e) => onChange('consolidationCategory', e.target.value)}
        />
      </div>
      <div className="filter-cell">
        <Select
          name="coverage"
          label="Coverage"
          options={[EMPTY, ...COVERAGE_LEVELS.map((v) => ({ value: v, label: v }))]}
          value={filters.coverage}
          onChange={(e) => onChange('coverage', e.target.value)}
        />
      </div>
      <div className="filter-cell">
        <Select
          name="inAmboss"
          label="In AMBOSS"
          options={[EMPTY, { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
          value={filters.inAmboss}
          onChange={(e) => onChange('inAmboss', e.target.value)}
        />
      </div>
      <Button variant="tertiary" size="s" onClick={onClear} disabled={!anyActive}>
        Clear
      </Button>
    </Inline>
  );
}
