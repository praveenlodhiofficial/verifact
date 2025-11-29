import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { FiFileText, FiHome, FiImage, FiLink2, FiSave, FiSettings, FiShield, FiX } from 'react-icons/fi';
import { FACT_CHECK_CONFIG, getOpenAIApiKey, isApiKeyConfigured } from './config';
import {
   extractClaims,
   factCheckContent,
   type FactCheckResponse,
   type FactCheckResult,
} from './factCheckService';
import { findSimilarSources, type SimilarSource } from './sourceFinderService';
import { generateSummary, type SummaryResponse } from './summaryService';

interface ScanData {
  url: string;
  title: string;
  timestamp: string;
  text: {
    allText: string;
    textLength: number;
    wordCount: number;
  };
  images: Array<{
    src: string;
    alt: string;
    width: number;
    height: number;
  }>;
  links: Array<{
    href: string;
    text: string;
    isExternal: boolean;
  }>;
  metadata: {
    description: string;
    keywords: string;
    author: string;
    viewport: string;
    openGraph: Record<string, string>;
  };
  structure: {
    headings: {
      h1: number;
      h2: number;
      h3: number;
      h4: number;
      h5: number;
      h6: number;
    };
    paragraphs: number;
    lists: number;
    forms: number;
    tables: number;
  };
  scripts: number;
  stylesheets: number;
  language: string;
}

function App() {
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'summary' | 'images' | 'links' | 'factcheck' | 'settings'>('overview');
  
  // Fact-checking state
  const [factCheckResults, setFactCheckResults] = useState<FactCheckResponse | null>(null);
  const [factChecking, setFactChecking] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  
  // Similar sources state
  const [similarSources, setSimilarSources] = useState<SimilarSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  
  // Summary state
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const scanWebpage = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.id) {
        throw new Error('No active tab found');
      }

      // Send message to content script to scan the webpage
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'scanWebpage' });
      
      if (response.success) {
        setScanData(response.data);
      } else {
        throw new Error(response.error || 'Failed to scan webpage');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan webpage. Make sure you are on a valid webpage.');
      console.error('Scan error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load API key from storage or config
  useEffect(() => {
    const loadApiKey = async () => {
      const key = await getOpenAIApiKey();
      if (key) {
        setApiKey(key);
      }
    };
    loadApiKey();
  }, []);

  // Function to load similar sources
  const loadSimilarSources = async () => {
    if (!scanData) return;
    
    const hasApiKey = await isApiKeyConfigured();
    if (!hasApiKey) {
      setSourcesError('API key is required to find similar sources. Please configure it in Settings.');
      return;
    }

    setLoadingSources(true);
    setSourcesError(null);

    try {
      const sources = await findSimilarSources(
        scanData.title,
        scanData.text.allText,
        scanData.url
      );
      setSimilarSources(sources.sources);
    } catch (err) {
      setSourcesError(err instanceof Error ? err.message : 'Failed to find similar sources.');
      console.error('Sources error:', err);
    } finally {
      setLoadingSources(false);
    }
  };

  // Load similar sources when Links tab is activated
  useEffect(() => {
    if (activeTab === 'links' && scanData && similarSources.length === 0 && !loadingSources) {
      loadSimilarSources();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, scanData]);

  // Load summary when Summary tab is activated
  useEffect(() => {
    if (activeTab === 'summary' && scanData && !summaryData && !loadingSummary) {
      loadSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, scanData]);

  // Function to load summary
  const loadSummary = async () => {
    if (!scanData) return;
    
    const hasApiKey = await isApiKeyConfigured();
    if (!hasApiKey) {
      setSummaryError('API key is required to generate summary. Please configure it in Settings.');
      return;
    }

    setLoadingSummary(true);
    setSummaryError(null);

    try {
      const summary = await generateSummary(
        scanData.title,
        scanData.text.allText,
        scanData.url
      );
      setSummaryData(summary);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Failed to generate summary.');
      console.error('Summary error:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  // Save API key to storage
  const saveApiKey = async () => {
    await chrome.storage.local.set({ openaiApiKey: apiKey });
    setShowApiKeyInput(false);
    alert('API key saved!');
  };

  // Fact-check the webpage content
  const performFactCheck = async () => {
    if (!scanData) return;
    
    // Check if API key is configured
    const hasApiKey = await isApiKeyConfigured();
    if (!hasApiKey) {
      setActiveTab('settings');
      alert('Please add your OpenAI API key in Settings or .env file first.');
      return;
    }

    setFactChecking(true);
    setError(null);

    try {
      // Extract key claims from the webpage text (using config default)
      const claims = extractClaims(scanData.text.allText, FACT_CHECK_CONFIG.maxClaims);
      
      if (claims.length === 0) {
        throw new Error('No verifiable claims found in the webpage content.');
      }

      // Perform fact-checking (API key will be retrieved from config/storage)
      const results = await factCheckContent(claims, scanData.title);
      setFactCheckResults(results);
      setActiveTab('factcheck');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fact-check content. Check your API key and try again.');
      console.error('Fact-check error:', err);
    } finally {
      setFactChecking(false);
    }
  };

  return (
    <div className="w-[600px] max-h-[700px] overflow-y-auto bg-white font-sans antialiased">
      <div className="sticky top-0 z-100 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 text-neutral-900 shadow-sm">
        <h1 className="m-0 text-lg font-semibold">Verifact Extension</h1>
        {scanData && (
          <div className="flex gap-2">
            <Button variant="default"
              onClick={performFactCheck}
              disabled={factChecking || loading}
              size="sm"
              title="Fact-check this webpage"
            >
              {factChecking ? 'Checking...' : '🔍 Fact Check'}
            </Button>
            <Button variant="default"
              onClick={scanWebpage}
              disabled={loading}
              size="sm"
            >
              {loading ? 'Scanning...' : 'Refresh Scan'}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 my-4 rounded-md border-l-4 border-red-600 bg-red-50 px-4 py-3 text-red-700">
          <p className="m-0">⚠️ {error}</p>
          <p className="mt-2 text-sm opacity-80">Try refreshing the page and scanning again.</p>
        </div>
      )}

      {/* Intro screen before first scan */}
      {!scanData && !loading && (
        <div className="flex flex-col items-center gap-8 px-6 py-10">
          <div className="w-full rounded-2xl border border-neutral-800/5 bg-neutral-50 px-6 py-8 text-center shadow-sm">
            <h2 className="mb-3 text-xl font-semibold text-neutral-900">
              Scan this page for misinformation
            </h2>
            <p className="text-sm text-neutral-600">
              Verifact analyzes the current tab, extracts key claims, checks them against trusted
              sources, and shows an overview, summary, images, similar sources, and fact-checks.
            </p>
          </div>
          <Button variant="default"
            onClick={scanWebpage}
            disabled={loading}
            size="lg"
          >
            {loading ? 'Scanning...' : 'Scan Now'}
          </Button>
        </div>
      )}

      {/* Loading state before data arrives */}
      {!scanData && loading && (
        <div className="flex flex-col items-center gap-4 px-6 py-10 text-neutral-600">
          <p className="text-base">Scanning this page for content…</p>
        </div>
      )}

      {scanData && !loading && (
        <div className="flex h-[640px]">
          {/* Sidebar tabs */}
          <div className="flex w-20 flex-col gap-3 border-r border-neutral-200 bg-neutral-50 px-2 py-4">
            <Button variant="default"
              onClick={() => setActiveTab('overview')}
              title="Overview"
            >
              <FiHome className="h-5 w-5" />
            </Button>
            <Button variant="default"
              onClick={() => setActiveTab('summary')}
              title="Summary"
            >
              <FiFileText className="h-5 w-5" />
            </Button>
            <Button variant="default"
              onClick={() => setActiveTab('images')}
              title="Images"
            >
              <FiImage className="h-5 w-5" />
            </Button>
            <Button variant="default"
              onClick={() => setActiveTab('links')}
              title="Similar Sources"
            >
              <FiLink2 className="h-5 w-5" />
            </Button>
            <Button variant="default"
              onClick={() => setActiveTab('factcheck')}
              title="Fact Check"
            >
              <FiShield className="h-5 w-5" />
            </Button>
          </div>

          {/* Main content area */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'overview' && (
              <div className="flex flex-col gap-6">
                <section>
                  <h2 className="mb-4 border-b-2 border-blue-500 pb-2 text-[1.1rem] font-semibold text-neutral-900">
                    Page Information
                  </h2>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <strong className="text-sm text-blue-500">Title:</strong>
                      <span className="text-neutral-700">{scanData.title || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <strong className="text-sm text-blue-500">URL:</strong>
                      <span className="text-balance text-xs text-neutral-500">{scanData.url}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <strong className="text-sm text-blue-500">Language:</strong>
                      <span className="text-neutral-700">{scanData.language}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <strong className="text-sm text-blue-500">Scanned:</strong>
                      <span className="text-neutral-700">
                        {new Date(scanData.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="mb-4 border-b-2 border-blue-500 pb-2 text-[1.1rem] font-semibold text-neutral-900">
                    Statistics
                  </h2>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg border border-neutral-200 bg-neutral-100 p-4 text-center text-neutral-900 shadow-sm">
                      <div className="mb-1 text-2xl font-bold text-blue-500">
                        {scanData.text.wordCount.toLocaleString()}
                      </div>
                      <div className="text-sm text-neutral-500">Words</div>
                    </div>
                    <div className="rounded-lg border border-neutral-200 bg-neutral-100 p-4 text-center text-neutral-900 shadow-sm">
                      <div className="mb-1 text-2xl font-bold text-blue-500">
                        {scanData.text.textLength.toLocaleString()}
                      </div>
                      <div className="text-sm text-neutral-500">Characters</div>
                    </div>
                    <div className="rounded-lg border border-neutral-200 bg-neutral-100 p-4 text-center text-neutral-900 shadow-sm">
                      <div className="mb-1 text-2xl font-bold text-blue-500">
                        {scanData.images.length}
                      </div>
                      <div className="text-sm text-neutral-500">Images</div>
                    </div>
                    <div className="rounded-lg border border-neutral-200 bg-neutral-100 p-4 text-center text-neutral-900 shadow-sm">
                      <div className="mb-1 text-2xl font-bold text-blue-500">
                        {scanData.scripts}
                      </div>
                      <div className="text-sm text-neutral-500">Scripts</div>
                    </div>
                  </div>
                </section>

                {scanData.metadata.description && (
                  <section className="mt-4">
                    <h2 className="mb-4 border-b-2 border-blue-500 pb-2 text-[1.1rem] font-semibold text-neutral-900">
                      Metadata
                    </h2>
                    {scanData.metadata.description && (
                      <div className="mb-4">
                        <strong className="mb-2 block text-sm text-blue-500">Description:</strong>
                        <p className="m-0 leading-relaxed text-neutral-700">
                          {scanData.metadata.description}
                        </p>
                      </div>
                    )}
                    {scanData.metadata.keywords && (
                      <div className="mb-4">
                        <strong className="mb-2 block text-sm text-blue-500">Keywords:</strong>
                        <p className="m-0 leading-relaxed text-neutral-700">
                          {scanData.metadata.keywords}
                        </p>
                      </div>
                    )}
                    {scanData.metadata.author && (
                      <div className="mb-4">
                        <strong className="mb-2 block text-sm text-blue-500">Author:</strong>
                        <p className="m-0 leading-relaxed text-neutral-700">
                          {scanData.metadata.author}
                        </p>
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}

            {activeTab === 'summary' && (
              <div className="animate-in fade-in-0 duration-300">
                {loadingSummary && (
                  <div className="px-8 py-12 text-center text-neutral-500">
                    <p className="m-0 text-[1.1rem]">📝 Generating summary...</p>
                  </div>
                )}

                {summaryError && (
                  <div className="mx-4 my-4 rounded-md border-l-4 border-red-600 bg-red-50 px-4 py-3 text-red-700">
                    <p className="m-0">⚠️ {summaryError}</p>
                    <Button variant="default"
                      onClick={loadSummary}
                      size="sm"
                    >
                      Try Again
                    </Button>
                  </div>
                )}

                {!loadingSummary && !summaryError && summaryData && (
                  <>
                    <div className="mb-6">
                      <div className="flex flex-wrap gap-4">
                        {summaryData.category && (
                          <span className="rounded-md bg-blue-500 px-3 py-2 text-sm font-semibold text-white">
                            {summaryData.category}
                          </span>
                        )}
                        <span
                          className={`rounded-md px-3 py-2 text-sm font-semibold ${
                            summaryData.sentiment === 'positive'
                              ? 'bg-emerald-50 text-emerald-700'
                              : summaryData.sentiment === 'negative'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-neutral-100 text-neutral-600'
                          }`}
                        >
                          {summaryData.sentiment === 'positive' && '😊 Positive'}
                          {summaryData.sentiment === 'negative' && '😟 Negative'}
                          {summaryData.sentiment === 'neutral' && '😐 Neutral'}
                        </span>
                      </div>
                    </div>

                    <section className="mb-8">
                      <h3 className="m-0 mb-4 border-b-2 border-blue-500 pb-2 text-xl font-semibold text-neutral-900">
                        Summary
                      </h3>
                      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 leading-relaxed text-neutral-800">
                        {summaryData.summary.split('\n\n').map((paragraph, index) => (
                          <p key={index} className={index === summaryData.summary.split('\n\n').length - 1 ? 'm-0' : 'mb-4'}>
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </section>

                    {summaryData.keyPoints && summaryData.keyPoints.length > 0 && (
                      <section className="mb-8">
                        <h3 className="m-0 mb-4 border-b-2 border-blue-500 pb-2 text-xl font-semibold text-neutral-900">
                          Key Points
                        </h3>
                        <ul className="m-0 list-none rounded-lg border border-neutral-200 bg-neutral-50 p-6 pl-6">
                          {summaryData.keyPoints.map((point, index) => (
                            <li
                              key={index}
                              className="relative mb-3 pl-6 leading-relaxed text-neutral-800 last:mb-0"
                            >
                              {point}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    <div className="rounded-md border border-neutral-200 bg-neutral-100 p-4">
                      <p className="m-0 text-neutral-700">
                        <strong>Original Word Count:</strong>{' '}
                        {summaryData.wordCount.toLocaleString()}
                      </p>
                    </div>
                  </>
                )}

                {!loadingSummary && !summaryError && !summaryData && (
                  <div className="px-8 py-12 text-center text-neutral-500">
                    <p className="mb-4">No summary generated yet.</p>
                             <Button variant="default"
                      onClick={loadSummary}
                    >
                      Generate Summary
                    </Button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'images' && (
              <div className="animate-in fade-in-0 duration-300">
                <h3 className="mb-4 text-lg font-semibold text-neutral-800">
                  Found {scanData.images.length} images
                </h3>
                <div className="grid max-h-[600px] grid-cols-3 gap-4 overflow-y-auto py-2">
                  {scanData.images.map((img, index) => (
                    <div
                      key={index}
                      className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white transition-all hover:border-blue-500 hover:-translate-y-0.5 hover:shadow-md hover:shadow-blue-500/15"
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-neutral-100">
                        <img 
                          src={img.src} 
                          alt={img.alt || `Image ${index + 1}`}
                          className="block h-full w-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML =
                                '<div class="flex h-full w-full items-center justify-center bg-neutral-100 text-xs text-neutral-500">Failed to load</div>';
                            }
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all hover:bg-black/50 hover:opacity-100">
                          <a 
                            href={img.src} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/90 text-xl text-white transition-all hover:bg-blue-500 hover:scale-110"
                            title="View full size"
                          >
                            🔍
                          </a>
                        </div>
                      </div>
                      <div className="bg-white p-3">
                        {img.alt && (
                          <p
                            className="mb-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-neutral-800"
                            title={img.alt}
                          >
                            {img.alt.length > 30 ? img.alt.substring(0, 30) + '...' : img.alt}
                          </p>
                        )}
                        {(img.width || img.height) && (
                          <p className="m-0 text-xs text-neutral-600">
                            {img.width} × {img.height}px
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {scanData.images.length === 0 && (
                    <p className="py-8 text-center text-sm italic text-neutral-500">
                      No images found on this page.
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'links' && (
              <div className="animate-in fade-in-0 duration-300">
                <div className="mb-6">
                  <h3 className="mb-1 text-lg font-semibold text-neutral-900">
                    Similar Sources & Related Articles
                  </h3>
                  <p className="m-0 text-sm text-neutral-600">
                    Articles and sources that discuss similar topics or information
                  </p>
                </div>
                
                {loadingSources && (
                  <div className="py-8 text-center text-neutral-500">
                    <p className="m-0">🔍 Searching for similar sources...</p>
                  </div>
                )}

                {sourcesError && (
                  <div className="mx-4 my-4 rounded-md border-l-4 border-red-600 bg-red-50 px-4 py-3 text-red-700">
                    <p className="m-0">⚠️ {sourcesError}</p>
                    <Button variant="default"
                      onClick={loadSimilarSources}
                      size="sm"
                    >
                      Try Again
                    </Button>
                  </div>
                )}

                {!loadingSources && !sourcesError && (
                  <div className="flex max-h-[500px] flex-col gap-4 overflow-y-auto">
                    {similarSources.length > 0 ? (
                      similarSources.map((source, index) => (
                        <div
                          key={index}
                          className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 transition-all hover:border-blue-500 hover:-translate-y-0.5 hover:shadow-md hover:shadow-blue-500/10"
                        >
                          <div className="mb-3">
                            <a 
                              href={source.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="no-underline"
                            >
                              <h4 className="m-0 mb-2 text-base font-semibold leading-snug text-blue-500 hover:underline">
                                {source.title}
                              </h4>
                            </a>
                            <div className="flex flex-wrap items-center gap-3">
                              {source.publisher && (
                                <span className="text-sm font-medium text-neutral-600">
                                  {source.publisher}
                                </span>
                              )}
                              <span className="rounded bg-blue-50 px-2 py-1 text-sm font-semibold text-blue-600">
                                Relevance: {source.relevance}%
                              </span>
                            </div>
                          </div>
                          <p className="my-3 text-sm leading-relaxed text-neutral-700">
                            {source.description}
                          </p>
                          <a 
                            href={source.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="mt-2 block break-all text-sm text-blue-500 hover:underline"
                          >
                            {source.url.length > 60 ? source.url.substring(0, 60) + '...' : source.url}
                          </a>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center text-neutral-500">
                        <p className="mb-4">No similar sources found yet.</p>
                        <Button variant="default"
                          onClick={loadSimilarSources}
                        >
                          Find Similar Sources
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}


            {activeTab === 'factcheck' && (
              <div className="animate-in fade-in-0 duration-300">
                {!factCheckResults ? (
                  <div className="py-8 text-center text-neutral-600">
                    <h3 className="mb-3 text-lg font-semibold text-neutral-800">
                      No Fact-Check Results Yet
                    </h3>
                    <p className="mb-4 text-sm">
                      Click the "🔍 Fact Check" button in the header to verify the information on this
                      webpage.
                    </p>
                    {!apiKey && (
                      <div className="mt-6 rounded-md border border-amber-400 bg-amber-100 px-4 py-3 text-sm text-amber-700">
                        <p className="m-0">
                          ⚠️ You need to add your OpenAI API key in Settings first.
                        </p>
                        <Button variant="default"
                          onClick={() => setActiveTab('settings')}
                          size="sm"
                        >
                          <FiSettings className="mr-2 h-5 w-5" /> Go to Settings
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <section className="mb-8">
                      <h3 className="mb-4 text-lg font-semibold text-neutral-900">
                        Fact-Check Summary
                      </h3>
                      <div
                        className={`flex gap-4 rounded-lg border-2 p-6 ${
                          factCheckResults.overallVerdict === 'mostly_true'
                            ? 'border-emerald-500 bg-emerald-50'
                            : factCheckResults.overallVerdict === 'mostly_false'
                            ? 'border-rose-500 bg-rose-50'
                            : factCheckResults.overallVerdict === 'mixed'
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-neutral-500 bg-neutral-100'
                        }`}
                      >
                        <div className="text-3xl font-bold leading-none">
                          {factCheckResults.overallVerdict === 'mostly_true' && '✓'}
                          {factCheckResults.overallVerdict === 'mostly_false' && '✗'}
                          {factCheckResults.overallVerdict === 'mixed' && '⚠'}
                          {factCheckResults.overallVerdict === 'unverified' && '?'}
                        </div>
                        <div className="flex-1">
                          <strong className="mb-2 block text-lg">
                            {factCheckResults.overallVerdict === 'mostly_true' && 'Mostly True'}
                            {factCheckResults.overallVerdict === 'mostly_false' &&
                              'Mostly False / Misinformation'}
                            {factCheckResults.overallVerdict === 'mixed' && 'Mixed / Partially True'}
                            {factCheckResults.overallVerdict === 'unverified' && 'Unverified'}
                          </strong>
                          <p className="m-0 leading-relaxed text-neutral-700">
                            {factCheckResults.summary}
                          </p>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="mb-4 text-lg font-semibold text-neutral-900">
                        Individual Claims Analysis
                      </h3>
                      {factCheckResults.claims.map((claim: FactCheckResult, index: number) => (
                        <div
                          key={index}
                          className={`mb-4 rounded-md border border-neutral-200 border-l-4 bg-neutral-50 p-4 ${
                            claim.verdict === 'true'
                              ? 'border-l-emerald-500 bg-emerald-50'
                              : claim.verdict === 'false'
                              ? 'border-l-rose-500 bg-rose-50'
                              : claim.verdict === 'misleading'
                              ? 'border-l-amber-500 bg-amber-50'
                              : 'border-l-neutral-500 bg-neutral-100'
                          }`}
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <span
                              className={`rounded px-3 py-1 text-sm font-semibold text-white ${
                                claim.verdict === 'true'
                                  ? 'bg-emerald-500'
                                  : claim.verdict === 'false'
                                  ? 'bg-rose-500'
                                  : claim.verdict === 'misleading'
                                  ? 'bg-amber-500'
                                  : 'bg-neutral-500'
                              }`}
                            >
                              {claim.verdict === 'true' && '✓ True'}
                              {claim.verdict === 'false' && '✗ False'}
                              {claim.verdict === 'misleading' && '⚠ Misleading'}
                              {claim.verdict === 'unverified' && '? Unverified'}
                            </span>
                            <span className="text-sm text-neutral-600">
                              Confidence: {claim.confidence}%
                            </span>
                          </div>
                          <div className="mb-3 leading-relaxed">
                            <strong className="text-blue-500">Claim:</strong>{' '}
                            <span>{claim.claim}</span>
                          </div>
                          <div className="mb-3 rounded bg-white p-3 leading-relaxed">
                            <strong className="text-blue-500">Explanation:</strong>{' '}
                            <span>{claim.explanation}</span>
                          </div>
                          <div className="mb-3 rounded bg-white p-3 text-sm leading-relaxed text-neutral-700">
                            <strong className="text-blue-500">Reasoning:</strong>{' '}
                            <span>{claim.reasoning}</span>
                          </div>
                          {claim.sources && claim.sources.length > 0 && (
                            <div className="mt-3">
                              <strong className="mb-2 block text-blue-500">Sources:</strong>
                              <ul className="m-0 list-disc pl-5">
                                {claim.sources.map((source: string, i: number) => (
                                  <li key={i} className="mb-1 leading-relaxed text-neutral-700">
                                    {source}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </section>
                  </>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="animate-in fade-in-0 duration-300">
                <h3 className="mb-4 text-lg font-semibold text-neutral-900">Settings</h3>
                <div className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-6">
                  <h4 className="mb-3 text-base font-semibold text-blue-500">OpenAI API Key</h4>
                  <p className="mb-4 text-sm leading-relaxed text-neutral-700">
                    To use fact-checking, you need a PipeShift API key (OpenAI-compatible).
                    <br />
                    <strong>Hackathon Participants:</strong> Your API key is already configured in the{' '}
                    <code>.env</code> file.
                    <br />
                    <br />
                    <strong>Note:</strong> You can set your API key in the <code>.env</code> file as{' '}
                    <code>VITE_OPENAI_API_KEY</code>. The key set here in Settings takes priority
                    over the .env file.
                    <br />
                    <br />
                    <strong>Current Configuration:</strong> Using Neysa&apos;s Qwen3 Vision-Language
                    model via PipeShift API (complimentary during Hackathon).
                  </p>
                  {!showApiKeyInput && (
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        value={apiKey ? '•'.repeat(20) : ''}
                        placeholder="No API key set"
                        readOnly
                        className="flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 font-mono text-sm"
                      />
                      <Button variant="default"
                        onClick={() => setShowApiKeyInput(true)}
                        size="sm"
                      >
                        {apiKey ? 'Change' : 'Add'} API Key
                      </Button>
                    </div>
                  )}
                  {showApiKeyInput && (
                    <div className="flex flex-col gap-3">
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="psai_... or sk-..."
                        className="flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 font-mono text-sm"
                      />
                      <div className="flex gap-2">
                        <Button variant="default"
                          onClick={saveApiKey}
                          size="sm"
                        >
                          <FiSave className="mr-2 h-5 w-5" /> Save
                        </Button>
                        <Button variant="default"
                          onClick={() => setShowApiKeyInput(false)}
                          size="sm"
                        >
                          <FiX className="mr-2 h-5 w-5" /> Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {apiKey && (
                    <p className="mt-2 text-sm font-semibold text-emerald-600">
                      ✓ API key is set
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-blue-300 bg-blue-50 p-6">
                  <h4 className="mb-3 text-base font-semibold text-blue-700">
                    About Fact-Checking
                  </h4>
                  <ul className="m-0 list-disc space-y-2 pl-5 text-sm leading-relaxed text-neutral-700">
                    <li>Uses Neysa&apos;s Qwen3 Vision-Language model (30B) via PipeShift API</li>
                    <li>PipeShift API is OpenAI-compatible, so it works seamlessly</li>
                    <li>Extracts key claims from webpage content</li>
                    <li>Provides verdicts with confidence scores</li>
                    <li>Includes sources and detailed reasoning</li>
                    <li>
                      <strong className="text-blue-700">
                        Complimentary access provided during the Hackathon
                      </strong>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App