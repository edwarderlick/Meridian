// Vercel Cron entrypoint — see vercel.json's `crons` entry for the schedule. Vercel signs cron
// invocations with `Authorization: Bearer $CRON_SECRET` automatically once CRON_SECRET is set in
// the project's environment variables; this checks that header so the endpoint can't be triggered
// (and re-run against every user's real data) by an outside request that merely knows the URL.
import { evaluateAlertsAndRecurring } from '../_lib/alertsEvaluator.js'

export default async function handler(req, res) {
  const expected = process.env.CRON_SECRET
  if (expected) {
    const authHeader = req.headers.authorization
    if (authHeader !== `Bearer ${expected}`) {
      console.warn('[cron/evaluate] rejected: missing/invalid CRON_SECRET bearer token')
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
  } else {
    console.warn('[cron/evaluate] CRON_SECRET is not configured — endpoint is unprotected. Set it before relying on this in production.')
  }

  try {
    const summary = await evaluateAlertsAndRecurring()
    console.log('[cron/evaluate] completed:', summary)
    res.status(200).json(summary)
  } catch (error) {
    console.error('[cron/evaluate] failed:', error)
    res.status(500).json({ error: 'Evaluation failed', detail: error instanceof Error ? error.message : String(error) })
  }
}
