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
import type { PipelineRunRow, StageContext } from '@/lib/data/pipeline';
import type { StageName } from '@/lib/workflows/lib/db-writes';
import type { CodeSource } from '@/lib/workflows/lib/sources';
import { PhaseGroup } from './phase-group';
import { SourcesCard } from './sources-card';
import { StageCard } from './stage-card';
import { StartMilestonesForm } from './start-milestones-form';
import { StartRunForm } from './start-run-form';

type StagesMap = Record<StageName, StageContext | null>;

export function PipelineDashboard({
  specialtySlug,
  run,
  stages,
  sources,
  milestoneSources,
}: {
  specialtySlug: string;
  run: PipelineRunRow | null;
  stages: StagesMap;
  sources: CodeSource[];
  milestoneSources: CodeSource[];
}) {
  const runActive =
    run !== null &&
    run.status !== 'completed' &&
    run.status !== 'failed' &&
    run.status !== 'cancelled';
  const extractCodesDone = stages.extract_codes?.stage.status === 'completed';
  const extractMilestonesDone = stages.extract_milestones?.stage.status === 'completed';
  const [showStartForm, setShowStartForm] = useState(false);
  const [showMilestonesForm, setShowMilestonesForm] = useState(false);
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

      <Stack space="s">
        <H2>Next step</H2>
        {(() => {
          // Priority order:
          //   1. A stage awaiting approval → render its full card so the
          //      Approve/Reject buttons are right there.
          //   2. A run is mid-flight → info callout (nothing to action).
          //   3. Preprocessing incomplete → the corresponding start CTA.
          //   4. Everything done → "Next: Map codes" placeholder.
          const codesStatus = stages.extract_codes?.stage.status;
          const milestonesStatus = stages.extract_milestones?.stage.status;

          if (codesStatus === 'awaiting_approval' && stages.extract_codes) {
            return (
              <StageCard
                title="Extract codes"
                description="Identify modules per PDF, then extract discrete items per module."
                stage={stages.extract_codes.stage}
                specialtySlug={specialtySlug}
                stageName="extract_codes"
                runUrls={stages.extract_codes.runUrls}
                events={stages.extract_codes.events}
                sources={sources}
              />
            );
          }
          if (milestonesStatus === 'awaiting_approval' && stages.extract_milestones) {
            return (
              <StageCard
                title="Extract milestones"
                description="Extract ACGME-style milestones for this specialty."
                stage={stages.extract_milestones.stage}
                specialtySlug={specialtySlug}
                stageName="extract_milestones"
                runUrls={stages.extract_milestones.runUrls}
                events={stages.extract_milestones.events}
                sources={milestoneSources}
              />
            );
          }
          if (runActive) {
            return (
              <Card title="Run in progress" titleAs="h3">
                <CardBox>
                  <Text color="secondary">
                    A workflow run is active — polling every 2s. Expand the relevant phase
                    below to watch progress.
                  </Text>
                </CardBox>
              </Card>
            );
          }
          if (!extractCodesDone) {
            return showStartForm ? (
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
            );
          }
          if (!extractMilestonesDone) {
            return showMilestonesForm ? (
              <Stack space="s">
                <Inline space="s" vAlignItems="center">
                  <H2>Extract milestones</H2>
                  <Button
                    variant="secondary"
                    onClick={() => setShowMilestonesForm(false)}
                  >
                    Cancel
                  </Button>
                </Inline>
                <Text color="secondary">Provide URLs or upload PDFs.</Text>
                <StartMilestonesForm
                  specialtySlug={specialtySlug}
                  sources={milestoneSources}
                />
              </Stack>
            ) : (
              <button
                type="button"
                onClick={() => setShowMilestonesForm(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <Card title="Extract milestones" titleAs="h3">
                  <CardBox>
                    <Text color="secondary">
                      Click to provide content outline URLs or upload PDFs. A single
                      Gemini call produces a plain-text milestones document across every
                      source.
                    </Text>
                  </CardBox>
                </Card>
              </button>
            );
          }
          return (
            <Card title="Next: Map codes" titleAs="h3">
              <CardBox>
                <Text color="secondary">
                  Per-code LLM + AMBOSS MCP lookup. Not yet implemented — this stage will
                  run once the mapping workflow is wired up.
                </Text>
              </CardBox>
            </Card>
          );
        })()}
      </Stack>

      <PhaseGroup title="Preprocessing">
        <Stack space="m">
          <StageCard
            title="Extract codes"
            description="Identify modules per PDF, then extract discrete items per module."
            stage={stages.extract_codes?.stage ?? null}
            specialtySlug={specialtySlug}
            stageName="extract_codes"
            runUrls={stages.extract_codes?.runUrls}
            events={stages.extract_codes?.events ?? []}
            sources={sources}
          />
          <StageCard
            title="Extract milestones"
            description="Extract ACGME-style milestones for this specialty."
            stage={stages.extract_milestones?.stage ?? null}
            specialtySlug={specialtySlug}
            stageName="extract_milestones"
            runUrls={stages.extract_milestones?.runUrls}
            events={stages.extract_milestones?.events ?? []}
            sources={milestoneSources}
          />
        </Stack>
      </PhaseGroup>

      <PhaseGroup title="Mapping">
        <StageCard
          title="Map codes"
          description="Per-code LLM + AMBOSS MCP lookup. Runs once preprocessing is approved."
          stage={stages.map_codes?.stage ?? null}
          specialtySlug={specialtySlug}
          stageName="map_codes"
          events={stages.map_codes?.events ?? []}
        />
      </PhaseGroup>

      <PhaseGroup title="Suggestion consolidation">
        <Stack space="m">
          <StageCard
            title="Primary (per category)"
            description="Combine mappings into new-article and article-update candidates."
            stage={stages.consolidate_primary?.stage ?? null}
            specialtySlug={specialtySlug}
            stageName="consolidate_primary"
            events={stages.consolidate_primary?.events ?? []}
          />
          <StageCard
            title="Articles (secondary)"
            description="Dedupe new-article candidates across the specialty."
            stage={stages.consolidate_articles?.stage ?? null}
            specialtySlug={specialtySlug}
            stageName="consolidate_articles"
            events={stages.consolidate_articles?.events ?? []}
          />
          <StageCard
            title="Sections (secondary)"
            description="Dedupe sections and updates within each consolidated article."
            stage={stages.consolidate_sections?.stage ?? null}
            specialtySlug={specialtySlug}
            stageName="consolidate_sections"
            events={stages.consolidate_sections?.events ?? []}
          />
        </Stack>
      </PhaseGroup>

      <SourcesCard kind="code" sources={sources} />
      <SourcesCard kind="milestone" sources={milestoneSources} />
    </Stack>
  );
}
