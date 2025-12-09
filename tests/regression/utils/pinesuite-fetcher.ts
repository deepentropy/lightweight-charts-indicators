/**
 * PineSuite Fetcher - Fetch CSV data from the private pinesuite repository
 */

/**
 * Fetch CSV data from the private deepentropy/pinesuite repository
 * @param filePath - Full path to CSV file (e.g., "data/20251207/Simple Moving Average.csv")
 * @param token - GitHub personal access token (defaults to PINESUITE_TOKEN env var)
 * @returns Raw CSV content as string
 * @throws Error if token is missing, network fails, or file not found
 */
export async function fetchPineSuiteCSV(
  filePath: string,
  token?: string
): Promise<string> {
  const githubToken = token || process.env.PINESUITE_TOKEN;

  if (!githubToken) {
    throw new Error('PINESUITE_TOKEN environment variable is not set');
  }

  const owner = 'deepentropy';
  const repo = 'pinesuite';

  // Normalize path: remove leading/trailing slashes
  const trimmedPath = filePath.replace(/^\/+|\/+$/g, '');

  // Replace spaces with %20 only if not already encoded
  // This prevents double encoding if the path is already partially encoded
  const normalizedPath = trimmedPath.replace(/ /g, '%20');

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${normalizedPath}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3.raw',
        'User-Agent': 'oakscriptJS-regression-tests',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      // Try to get more details from the response body
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        // ignore
      }

      if (response.status === 404) {
        // 404 on private repo could mean no access OR file not found
        throw new Error(`File not found or no access: ${filePath} (URL: ${url}, Status: ${response.status})`);
      } else if (response.status === 401) {
        throw new Error(`Authentication failed: Invalid token or token expired`);
      } else if (response.status === 403) {
        throw new Error(`Access forbidden: Token may not have access to deepentropy/pinesuite. Response: ${errorBody}`);
      } else {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}. Response: ${errorBody}`);
      }
    }

    const csvContent = await response.text();
    return csvContent;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to fetch ${filePath}: ${String(error)}`);
  }
}

/**
 * Check if PINESUITE_TOKEN is available
 */
export function hasPineSuiteToken(): boolean {
  return !!process.env.PINESUITE_TOKEN;
}
