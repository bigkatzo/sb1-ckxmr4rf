// Mock Supabase client for tests
export const supabase = {
  storage: {
    from: () => ({
      upload: () => Promise.resolve({
        data: { path: 'test-path' },
        error: null
      }),
      getPublicUrl: () => ({
        data: { publicUrl: 'https://example.com/test-path' }
      })
    })
  }
}; 