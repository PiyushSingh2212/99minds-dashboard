const router = require('express').Router();
const Lead   = require('../models/Lead');

function getClient() {
  const Anthropic = require('@anthropic-ai/sdk');
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function parseJson(text) {
  const m = text.match(/\{[\s\S]*?\}/);
  if (!m) throw new Error('No JSON in response');
  return JSON.parse(m[0]);
}

/* ── POST /api/ai/score  { leadIds: [id, ...] } ─────────────────── */
router.post('/score', async (req, res) => {
  const { leadIds } = req.body;
  if (!Array.isArray(leadIds) || !leadIds.length)
    return res.status(400).json({ error: 'leadIds array required' });

  try {
    const client = getClient();
    const leads  = await Lead.find({ _id: { $in: leadIds } });

    const results = await Promise.all(leads.map(async (lead) => {
      try {
        const msg = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 150,
          messages: [{
            role: 'user',
            content:
`Score this B2B lead for ICP fit 1-10. Return JSON only, no other text.

Name: ${lead.fullName}
Title: ${lead.currentJob || ''}
Company: ${lead.companyName || ''}
Industry: ${lead.industryTag || lead.companyIndustry || ''}
Location: ${lead.location || ''}
Company Size: ${lead.companySize || ''}
Headline: ${lead.headline || ''}

Return exactly: {"score":number,"matchesIcp":"YES"|"MAYBE"|"NO","reason":"max 20 words"}`,
          }],
        });
        const scored = parseJson(msg.content[0].text);
        await Lead.findByIdAndUpdate(lead._id, {
          icpScore:   scored.score,
          matchesIcp: scored.matchesIcp,
          scoreReason: scored.reason,
        });
        return { id: lead._id, ok: true, ...scored };
      } catch (e) {
        return { id: lead._id, ok: false, error: e.message };
      }
    }));

    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/ai/enrich  { leadIds: [id, ...] } ────────────────── */
router.post('/enrich', async (req, res) => {
  const { leadIds } = req.body;
  if (!Array.isArray(leadIds) || !leadIds.length)
    return res.status(400).json({ error: 'leadIds array required' });

  try {
    const client = getClient();
    const leads  = await Lead.find({ _id: { $in: leadIds } });

    const results = await Promise.all(leads.map(async (lead) => {
      const missing = [
        !lead.industryTag    && 'industryTag',
        !lead.companyIndustry && 'companyIndustry',
        !lead.companySize    && 'companySize',
        !lead.companyType    && 'companyType',
        !lead.headline       && 'headline',
      ].filter(Boolean);

      if (!missing.length) return { id: lead._id, skipped: true };

      try {
        const msg = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content:
`Infer missing B2B lead fields from context. Return JSON only.

Name: ${lead.fullName}
Title: ${lead.currentJob || ''}
Company: ${lead.companyName || ''}
Location: ${lead.location || ''}

Fill ONLY the fields listed, with short values (e.g. "SaaS", "51-200", "Private", headline max 12 words).
Return exactly: {${missing.map(f => `"${f}":""`).join(',')}}`,
          }],
        });
        const json   = parseJson(msg.content[0].text);
        const update = {};
        for (const [k, v] of Object.entries(json)) {
          if (v && typeof v === 'string' && v.trim() && missing.includes(k))
            update[k] = v.trim();
        }
        if (Object.keys(update).length) await Lead.findByIdAndUpdate(lead._id, update);
        return { id: lead._id, ok: true, updated: Object.keys(update) };
      } catch (e) {
        return { id: lead._id, ok: false, error: e.message };
      }
    }));

    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/ai/outreach  { leadIds, context? } ───────────────── */
router.post('/outreach', async (req, res) => {
  const { leadIds, context } = req.body;
  if (!Array.isArray(leadIds) || !leadIds.length)
    return res.status(400).json({ error: 'leadIds array required' });

  try {
    const client = getClient();
    const leads  = await Lead.find({ _id: { $in: leadIds } });

    const messages = await Promise.all(leads.map(async (lead) => {
      const firstName = lead.firstName || lead.fullName.split(' ')[0];
      try {
        const msg = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 250,
          messages: [{
            role: 'user',
            content:
`Write a personalized cold LinkedIn message for this B2B lead. Max 120 words. Be specific to their role — not generic.${context ? `\n\nProduct/service context: ${context}` : ''}

Lead:
- Name: ${firstName}
- Title: ${lead.currentJob || 'Professional'}
- Company: ${lead.companyName || 'their company'}
- Industry: ${lead.industryTag || lead.companyIndustry || ''}
- Headline: ${lead.headline || ''}

Write just the message text. No subject line. Start with "Hi ${firstName}," or "Hey ${firstName},".`,
          }],
        });
        const text = msg.content[0].text.trim();
        await Lead.findByIdAndUpdate(lead._id, { outreachAngle: text.substring(0, 500) });
        return { id: lead._id, fullName: lead.fullName, message: text, ok: true };
      } catch (e) {
        return { id: lead._id, fullName: lead.fullName, ok: false, error: e.message };
      }
    }));

    res.json({ ok: true, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
