/* Corner Office - replay mode: scripted sample workday, no sign-in, no Pollen spent. */
window.CO_DEMO = {
  companies: [
    { name: 'Fable & Co', tagline: 'Story studio shipping brand tales', business: 'brand storytelling' },
    { name: 'Pixel Foundry', tagline: 'Landing pages that convert', business: 'web design' },
    { name: 'Signal Post', tagline: 'Weekly market signal digest', business: 'research newsletter' },
    { name: 'Bright Cart', tagline: 'Product copy for small shops', business: 'e-commerce copywriting' },
    { name: 'Ledger Lark', tagline: 'Bookkeeping summaries in plain words', business: 'bookkeeping reports' },
    { name: 'Mote Labs', tagline: 'Micro-app prototypes on demand', business: 'app prototyping' },
  ],
  dayScript: [
    { floor: 0, role: 'research', text: 'Scanned 14 brand briefs; 3 trends worth pitching: quiet luxury, analog hobbies, repair culture.' },
    { floor: 0, role: 'build', text: 'Drafted 2 narrative outlines for the repair-culture angle, 400 words each.' },
    { floor: 0, role: 'report', text: 'Day summary: 2 outlines ready. Decision needed: pitch Acme Bicycles or Fern Hardware first?' , decision: 'Which client gets the repair-culture pitch first: Acme Bicycles or Fern Hardware?' },
    { floor: 1, role: 'research', text: 'Audited 9 competitor landing pages; common gap: no pricing above the fold.' },
    { floor: 1, role: 'build', text: 'Produced hero-section wireframe copy, pricing block above fold, 3 CTA variants.' },
    { floor: 1, role: 'report', text: 'Day summary: wireframe pack ready for owner review.' },
    { floor: 2, role: 'research', text: 'Collected 22 market headlines; clustered into 4 signal themes.' },
    { floor: 2, role: 'build', text: 'Wrote this week\'s digest draft: 4 themes, 600 words, 3 charts described.' },
    { floor: 2, role: 'report', text: 'Day summary: digest draft staged. Decision needed: lead with semiconductors or freight rates?', decision: 'Lead story for Friday\'s digest: semiconductors or freight rates?' },
    { floor: 3, role: 'research', text: 'Reviewed 30 product listings; found 6 with missing benefit-led bullets.' },
    { floor: 3, role: 'build', text: 'Rewrote bullets for the 6 weakest listings, benefit-led, under 80 chars each.' },
    { floor: 3, role: 'report', text: 'Day summary: 6 listing rewrites ready to publish.' },
    { floor: 4, role: 'research', text: 'Parsed October ledger export; flagged 4 unusual expenses over $500.' },
    { floor: 4, role: 'build', text: 'Wrote plain-words October summary with the 4 flagged expenses explained.' },
    { floor: 4, role: 'report', text: 'Day summary: October summary ready. Decision needed: escalate the duplicate SaaS charge?', decision: 'Escalate the duplicate $240 SaaS charge to the client, or absorb and note it?' },
    { floor: 5, role: 'research', text: 'Scored 11 inbound prototype requests by effort vs. fee.' },
    { floor: 5, role: 'build', text: 'Scoped the top 3 requests into one-page build plans.' },
    { floor: 5, role: 'report', text: 'Day summary: 3 build plans staged for owner approval.' },
  ],
  // fake usage for replay receipts (sample numbers, clearly labeled replay)
  receiptFor(role, floorName, i) {
    const pin = 320 + ((i * 37) % 140), pout = 180 + ((i * 53) % 160);
    return {
      time: new Date().toISOString(),
      job: `${floorName} · ${role}`,
      agent: `replay/${floorName.toLowerCase().replace(/[^a-z]+/g, '-')}-${role}`,
      promptTokens: pin, completionTokens: pout,
      cost: +(((pin + pout) / 1e6) * 0.4).toFixed(6),
    };
  },
};
