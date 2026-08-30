export const SAMPLE_PACKET = {
  schemaVersion: 1 as const,
  horizon: 'daily' as const,
  sources: [
    {
      id: 'ev_sun_1',
      title: 'Sun transit notes',
      url: 'https://example.com/sun',
      snippet: 'A current sun-specific note.',
      domain: 'example.com',
      provenance: {
        provider: 'agent' as const,
        method: 'untrusted_submission' as const,
        query: 'sun daily',
      },
    },
  ],
  sections: [
    {
      id: 'energyOverview' as const,
      title: 'Energy',
      frameworkLabel: 'Guide',
      reflection: 'Sit with the next hour.',
      evidenceIds: ['ev_sun_1'],
    },
  ],
}
