/**
 * Safe fetch helper that handles JSON and non-JSON (HTML 404/500/etc.) responses gracefully,
 * preventing `Unexpected token 'T', "The page c"... is not valid JSON` errors.
 */
export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  try {
    const response = await fetch(input, init);
    const contentType = response.headers.get('content-type') || '';

    let parsedData: any = null;
    let rawText = '';

    if (contentType.includes('application/json')) {
      try {
        parsedData = await response.json();
      } catch (jsonErr) {
        rawText = await response.text();
      }
    } else {
      rawText = await response.text();
    }

    if (!response.ok) {
      const errorMsg =
        parsedData?.message ||
        parsedData?.error ||
        (rawText && rawText.length < 200 ? rawText : `Ralat pelayan (${response.status})`);

      return {
        ok: false,
        status: response.status,
        data: parsedData,
        error: errorMsg,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: parsedData ?? ({ message: rawText } as any),
      error: null,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err?.message || 'Gagal menyambung ke perkhidmatan pelayan.',
    };
  }
}
