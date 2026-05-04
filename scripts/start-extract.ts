/**
 * Ad-hoc dev trigger for the extract-codes workflow.
 *
 * Usage: npm run wf:extract -- <specialty-slug> <url1> [url2 ...]
 *
 * POSTs /api/workflows/extract on the running dev server with the specialty
 * slug + content outline URLs. The route handles DB prep + start(). Prints
 * run ids + the approval hook token.
 */

const DEV_URL = process.env.DEV_URL ?? 'http://localhost:3000';

async function main() {
  const [, , slug, ...urls] = process.argv;
  if (!slug || urls.length === 0) {
    console.error(
      'Usage: tsx scripts/start-extract.ts <specialty-slug> <url1> [url2 ...]',
    );
    process.exit(1);
  }

  const inputs = urls.map((url) => ({ source: 'ab', url }));
  const res = await fetch(`${DEV_URL}/api/workflows/extract`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ specialtySlug: slug, inputs }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`HTTP ${res.status}:`, body);
    process.exit(1);
  }

  console.log('\n--- extract-codes run started ---');
  console.log('pipeline run id:    ', body.runId);
  console.log('workflow run id:    ', body.workflowRunId);
  console.log('specialty:          ', body.specialty, `(${body.urls} urls)`);
  console.log('approval hook token:', body.approvalToken);
  console.log('\nObservability: npx workflow web', body.workflowRunId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
