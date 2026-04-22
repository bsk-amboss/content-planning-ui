'use client';

import {
  Button,
  Callout,
  Card,
  CardBox,
  H2,
  Inline,
  Stack,
  Text,
} from '@amboss/design-system';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type {
  PipelineEventRow,
  PipelineRunRow,
  PipelineStageRow,
} from '@/lib/data/pipeline';
import type { StageName } from '@/lib/workflows/lib/db-writes';
import type { CodeSource } from '@/lib/workflows/lib/sources';
import { CodeSourcesCard } from './code-sources-card';
import { PhaseGroup } from './phase-group';
import { StageCard } from './stage-card';
import { StartRunForm } from './start-run-form';

type StagesMap = {
  extract_codes: PipelineStageRow | null;
  extract_milestones: PipelineStageRow | null;
  map_codes: PipelineStageRow | null;
  consolidate_primary: PipelineStageRow | null;
  consolidate_articles: PipelineStageRow | null;
  consolidate_sections: PipelineStageRow | null;
};

export function PipelineDashboard({
  specialtySlug,
  run,
  stages,
  events,
  sources,
}: {
  specialtySlug: string;
  run: PipelineRunRow | null;
  stages: StagesMap;
  events: PipelineEventRow[];
  sources: CodeSource[];
}) {
  const eventsByStage = new Map<StageName, PipelineEventRow[]>();
  for (const e of events) {
    const key = e.stage as StageName;
    const list = eventsByStage.get(key) ?? [];
    list.push(e);
    eventsByStage.set(key, list);
  }
  const runActive =
    run !== null &&
    run.status !== 'completed' &&
    run.status !== 'failed' &&
    run.status !== 'cancelled';
  const runUrls = run?.contentOutlineUrls;
  const extractCodesDone = stages.extract_codes?.status === 'completed';
  const [showStartForm, setShowStartForm] = useState(false);
  const router = useRouter();

  // While a run is active, poll the server for fresh stage/run data every 2s
  // so the UI reflects progress without manual refresh. Stops automatically
  // once the run transitions to a terminal state.
  useEffect(() => {
    if (!runActive) return;
    const id = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(id);
  }, [runActive, router]);

  return (
    <Stack space="l">
      {runActive ? (
        <Inline space="s" vAlignItems="center">
          <Text color="secondary">
            Live · polling every 2s · workflow run{' '}
            <code>{run.workflowRunId ?? run.id}</code>
          </Text>
        </Inline>
      ) : null}
      {run?.error ? <Callout type="error" text={run.error} /> : null}

      {!runActive && !extractCodesDone ? (
        showStartForm ? (
          <Stack space="s">
            <Inline space="s" vAlignItems="center">
              <H2>Extract codes</H2>
              <Button variant="secondary" onClick={() => setShowStartForm(false)}>
                Cancel
              </Button>
            </Inline>
            <Text color="secondary">Provide URLs or upload PDFs.</Text>
            <StartRunForm specialtySlug={specialtySlug} sources={sources} />
          </Stack>
        ) : (
          <button
            type="button"
            onClick={() => setShowStartForm(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              textAlign: 'left',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <Card title="Extract codes" titleAs="h3">
              <CardBox>
                <Text color="secondary">
                  Click to provide content outline URLs or upload PDFs for this run.
                </Text>
              </CardBox>
            </Card>
          </button>
        )
      ) : null}

      {!runActive && extractCodesDone ? (
        <Card title="Next: Map codes" titleAs="h3">
          <CardBox>
            <Text color="secondary">
              Per-code LLM + AMBOSS MCP lookup. Not yet implemented — this stage will run
              once the mapping workflow is wired up.
            </Text>
          </CardBox>
        </Card>
      ) : null}

      <PhaseGroup title="Preprocessing">
        <Stack space="m">
          <StageCard
            title="Extract codes"
            description="Identify modules per PDF, then extract discrete items per module."
            stage={stages.extract_codes}
            specialtySlug={specialtySlug}
            stageName="extract_codes"
            runUrls={runUrls}
            events={eventsByStage.get('extract_codes') ?? []}
            sources={sources}
          />
          <StageCard
            title="Extract milestones"
            description="Extract ACGME-style milestones for this specialty."
            stage={stages.extract_milestones}
            specialtySlug={specialtySlug}
            stageName="extract_milestones"
            runUrls={runUrls}
            events={eventsByStage.get('extract_milestones') ?? []}
            sources={sources}
          />
        </Stack>
      </PhaseGroup>

      <PhaseGroup title="Mapping">
        <StageCard
          title="Map codes"
          description="Per-code LLM + AMBOSS MCP lookup. Runs once preprocessing is approved."
          stage={stages.map_codes}
          specialtySlug={specialtySlug}
          stageName="map_codes"
          events={eventsByStage.get('map_codes') ?? []}
        />
      </PhaseGroup>

      <PhaseGroup title="Suggestion consolidation">
        <Stack space="m">
          <StageCard
            title="Primary (per category)"
            description="Combine mappings into new-article and article-update candidates."
            stage={stages.consolidate_primary}
            specialtySlug={specialtySlug}
            stageName="consolidate_primary"
            events={eventsByStage.get('consolidate_primary') ?? []}
          />
          <StageCard
            title="Articles (secondary)"
            description="Dedupe new-article candidates across the specialty."
            stage={stages.consolidate_articles}
            specialtySlug={specialtySlug}
            stageName="consolidate_articles"
            events={eventsByStage.get('consolidate_articles') ?? []}
          />
          <StageCard
            title="Sections (secondary)"
            description="Dedupe sections and updates within each consolidated article."
            stage={stages.consolidate_sections}
            specialtySlug={specialtySlug}
            stageName="consolidate_sections"
            events={eventsByStage.get('consolidate_sections') ?? []}
          />
        </Stack>
      </PhaseGroup>

      <CodeSourcesCard sources={sources} />
    </Stack>
  );
}
