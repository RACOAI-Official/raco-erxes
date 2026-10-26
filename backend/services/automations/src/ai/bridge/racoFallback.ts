export const invokeWithRacoFallback = async <T>(
  primary: () => Promise<T>,
  fallback?: () => Promise<T>,
): Promise<T> => {
  try {
    return await primary();
  } catch (error: unknown) {
    if (!fallback) {
      throw error;
    }
    try {
      return await fallback();
    } catch {
      // Upstream errors can contain credentials or customer prompts.
      throw new Error(
        'Raco LLM and the configured Gemini fallback failed. Check server-side credentials, model availability, and provider quotas.',
      );
    }
  }
};
